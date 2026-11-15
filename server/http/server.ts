import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"
import type { PermissionAnswer } from "../protocol/encode.ts"
import { parseMentions } from "../conversation/mentions.ts"
import { buildArgs } from "../session/args.ts"
import type { PermissionItem, QuestionItem } from "../timeline/reduce.ts"
import type { SessionEvent, SessionState } from "../session/session.ts"
import type { Agent, NewAgent, SessionRow, Store } from "../store/store.ts"

export type SessionHandle = {
  prompt(text: string): void
  answer(requestId: string, answer: PermissionAnswer): void
  interrupt(): void
  stop(): Promise<void>
}

export type StartSession = (options: {
  agent: Agent
  args: string[]
  cwd: string
  onEvent: (event: SessionEvent) => void
}) => SessionHandle

export type ServerOptions = {
  store: Store
  startSession: StartSession
}

type LiveSession = {
  id: string
  agentId: string
  conversationId: string
  handle: SessionHandle | null
  state: SessionState
  queue: string[]
  lastOutSeq: number
  exit: { code: number | null; stderr: string } | null
}

type StreamEvent = { id: number; data: string }

type Channel = {
  nextId: number
  log: StreamEvent[]
  clients: Set<ServerResponse>
}

const URGENCY: SessionState[] = [
  "waiting",
  "busy",
  "starting",
  "failed",
  "idle",
  "exited",
]

const HOST = "127.0.0.1"
const MAX_BODY_BYTES = 1_000_000

export function createServer({ store, startSession }: ServerOptions) {
  const live = new Map<string, LiveSession>()
  const channels = new Map<string, Channel>()
  const promptCursors = new Map<string, number>()
  const openRequests = new Map<
    string,
    { session: LiveSession; card: PermissionItem | QuestionItem }
  >()

  function channelOf(conversationId: string): Channel {
    let channel = channels.get(conversationId)
    if (!channel) {
      channel = { nextId: 1, log: [], clients: new Set() }
      channels.set(conversationId, channel)
    }
    return channel
  }

  function publish(conversationId: string, data: unknown) {
    const channel = channelOf(conversationId)
    const event = { id: channel.nextId, data: JSON.stringify(data) }
    channel.nextId += 1
    channel.log.push(event)
    for (const client of channel.clients) writeEvent(client, event)
  }

  function findLive(agentId: string, conversationId: string) {
    for (const session of live.values()) {
      if (
        session.agentId === agentId &&
        session.conversationId === conversationId
      ) {
        return session
      }
    }
    return undefined
  }

  function liveSessionFor(agentId: string, conversationId: string) {
    const running = findLive(agentId, conversationId)
    if (running) return running
    const earlier = store.latestSession(agentId, conversationId)
    return start(
      store.createSession({
        agentId,
        conversationId,
        claudeSessionId: earlier?.claudeSessionId,
      })
    )
  }

  function start(row: SessionRow): LiveSession | undefined {
    const agent = store.getAgent(row.agentId)
    if (!agent) return undefined
    const session: LiveSession = {
      id: row.id,
      agentId: row.agentId,
      conversationId: row.conversationId,
      handle: null,
      state: "starting",
      queue: [],
      lastOutSeq: 0,
      exit: null,
    }
    live.set(session.id, session)
    session.handle = startSession({
      agent,
      args: buildArgs(agent, row),
      cwd: agent.cwd,
      onEvent: (event) => onSessionEvent(session, event),
    })
    return session
  }

  function onSessionEvent(session: LiveSession, event: SessionEvent) {
    if (event.type === "line") {
      const seq = store.recordLine(session.id, event.direction, event.text)
      if (event.direction === "out") session.lastOutSeq = seq
    }
    if (event.type === "changes") {
      const entries = store.saveItems(
        session.id,
        event.items,
        session.lastOutSeq
      )
      for (const entry of entries) {
        publish(session.conversationId, { type: "item", entry })
        if (entry.item.kind === "message" && entry.item.status === "done") {
          for (const agentId of mentionedAgents(
            session.conversationId,
            entry.item.text,
            session.agentId
          )) {
            prompt(agentId, session.conversationId, entry.item.text)
          }
        }
      }
      for (const item of event.items) {
        if (item.kind !== "permission" && item.kind !== "question") continue
        if (item.status === "pending") {
          openRequests.set(item.requestId, { session, card: item })
        } else {
          openRequests.delete(item.requestId)
        }
      }
    }
    if (event.type === "exit") {
      session.exit = { code: event.code, stderr: event.stderr }
      store.updateSession(session.id, {
        endedAt: new Date().toISOString(),
        exitCode: event.code,
        stderr: event.stderr === "" ? null : event.stderr,
      })
    }
    if (event.type === "claude_session") {
      store.updateSession(session.id, {
        claudeSessionId: event.claudeSessionId,
      })
    }
    if (event.type === "state") {
      session.state = event.state
      store.updateSession(session.id, { state: event.state })
      publish(session.conversationId, {
        type: "agent_state",
        agentId: session.agentId,
        state: event.state,
      })
      if (event.state === "idle") deliverNext(session)
      if (event.state === "failed") addFailedNotice(session)
      if (event.state === "exited" || event.state === "failed") {
        live.delete(session.id)
      }
    }
  }

  function addFailedNotice(session: LiveSession) {
    const [entry] = store.saveItems(session.id, [
      {
        kind: "notice",
        id: "exit",
        reason: "failed",
        status: "failed",
        exitCode: session.exit?.code ?? null,
        stderr: session.exit?.stderr ?? "",
      },
    ])
    if (entry) publish(session.conversationId, { type: "item", entry })
  }

  function agentState(agentId: string): SessionState {
    let state: SessionState = "exited"
    for (const session of live.values()) {
      if (session.agentId !== agentId) continue
      if (URGENCY.indexOf(session.state) < URGENCY.indexOf(state)) {
        state = session.state
      }
    }
    return state
  }

  function liveState(agentId: string, conversationId: string): SessionState {
    return findLive(agentId, conversationId)?.state ?? "exited"
  }

  function deliver(session: LiveSession, text: string) {
    session.queue.push(text)
    deliverNext(session)
  }

  function deliverNext(session: LiveSession) {
    if (session.state !== "idle") return
    const text = session.queue.shift()
    if (text !== undefined) session.handle?.prompt(text)
  }

  function promptFor(
    agentId: string,
    conversationId: string,
    text: string
  ): string {
    if (store.getConversation(conversationId)?.kind === "dm") return text
    const author = `agent:${agentId}`
    const entries = store.listTimeline(conversationId)
    const key = `${agentId} ${conversationId}`
    const cursor =
      promptCursors.get(key) ??
      Math.max(
        0,
        ...entries
          .filter((entry) => entry.authorKey === author)
          .map((entry) => entry.seq)
      )
    promptCursors.set(
      key,
      Math.max(cursor, ...entries.map((entry) => entry.seq))
    )
    return entries
      .filter(
        (entry) =>
          entry.seq > cursor &&
          entry.authorKey !== author &&
          entry.item.kind === "message" &&
          entry.item.status === "done"
      )
      .map((entry) => {
        const text = entry.item.kind === "message" ? entry.item.text : ""
        return `[${authorName(entry.authorKey)}] ${text}`
      })
      .join("\n")
  }

  function authorName(authorKey: string): string {
    if (!authorKey.startsWith("agent:")) return "User"
    return store.getAgent(authorKey.slice("agent:".length))?.name ?? "agent"
  }

  function prompt(agentId: string, conversationId: string, text: string) {
    const session = liveSessionFor(agentId, conversationId)
    if (session) deliver(session, promptFor(agentId, conversationId, text))
  }

  function addressedAgents(conversationId: string, text: string): string[] {
    const conversation = store.getConversation(conversationId)
    if (!conversation) return []
    if (conversation.kind === "dm" || conversation.replyMode === "every") {
      return agentIdsOf(conversationId)
    }
    return mentionedAgents(conversationId, text, null)
  }

  function mentionedAgents(
    conversationId: string,
    text: string,
    authorAgentId: string | null
  ): string[] {
    if (store.getConversation(conversationId)?.kind === "dm") return []
    const members = agentIdsOf(conversationId).flatMap((agentId) => {
      const agent = store.getAgent(agentId)
      return agent && agent.id !== authorAgentId
        ? [{ key: agent.id, name: agent.name }]
        : []
    })
    return parseMentions(text, members)
  }

  function agentIdsOf(conversationId: string): string[] {
    const members = store.getConversation(conversationId)?.members ?? []
    return members
      .filter((member) => member.startsWith("agent:"))
      .map((member) => member.slice("agent:".length))
  }

  const http = createHttpServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) send(response, 500, { error: "server error" })
    })
  })

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", `http://${HOST}`)
    const parts = url.pathname.split("/").filter(Boolean)
    const route = (method: string, pattern: string) =>
      matchRoute(request.method, parts, method, pattern)
    let params: Record<string, string> | null

    if ((params = route("POST", "api/conversations/:id/messages"))) {
      const conversationId = params.id
      if (!store.getConversation(conversationId)) {
        return send(response, 404, { error: "no such conversation" })
      }
      const body = await readJson(request)
      const text = typeof body.text === "string" ? body.text : ""
      if (text.trim() === "") {
        return send(response, 400, { error: "Write a message." })
      }
      const entry = store.addUserMessage(conversationId, text)
      publish(conversationId, { type: "item", entry })
      for (const agentId of addressedAgents(conversationId, text)) {
        prompt(agentId, conversationId, text)
      }
      return send(response, 202, { entry })
    }

    if ((params = route("GET", "api/conversations/:id/timeline"))) {
      return send(response, 200, {
        items: store.listTimeline(params.id),
        lastEventId: channelOf(params.id).nextId - 1,
      })
    }

    if ((params = route("GET", "api/conversations/:id/events"))) {
      const channel = channelOf(params.id)
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      })
      response.flushHeaders()
      const lastEventId = Number(
        request.headers["last-event-id"] ??
          url.searchParams.get("lastEventId") ??
          Number.NaN
      )
      if (Number.isInteger(lastEventId)) {
        for (const event of channel.log) {
          if (event.id > lastEventId) writeEvent(response, event)
        }
      }
      channel.clients.add(response)
      request.on("close", () => channel.clients.delete(response))
      return
    }

    if ((params = route("POST", "api/conversations/:id/stop"))) {
      for (const session of live.values()) {
        if (session.conversationId !== params.id) continue
        session.queue = []
        if (session.state === "busy" || session.state === "waiting") {
          session.handle?.interrupt()
        }
      }
      return send(response, 202, {})
    }

    if ((params = route("POST", "api/requests/:id"))) {
      const open = openRequests.get(params.id)
      if (!open) return send(response, 404, { error: "no open request" })
      const body = await readJson(request)
      open.session.handle?.answer(params.id, permissionAnswer(open.card, body))
      return send(response, 202, {})
    }

    if (route("GET", "api/agents")) {
      const agents = store
        .listAgents()
        .map((agent) => ({ ...agent, state: agentState(agent.id) }))
      return send(response, 200, { agents })
    }

    if (route("POST", "api/agents")) {
      const agent = toNewAgent(await readJson(request))
      const empty = emptyFields(agent)
      if (empty) return send(response, 400, { error: empty })
      return send(response, 201, { agent: store.createAgent(agent) })
    }

    if ((params = route("GET", "api/agents/:id"))) {
      const agent = store.getAgent(params.id)
      if (!agent) return send(response, 404, { error: "no such agent" })
      return send(response, 200, { agent })
    }

    if ((params = route("PATCH", "api/agents/:id"))) {
      const current = store.getAgent(params.id)
      if (!current) return send(response, 404, { error: "no such agent" })
      const agent = toNewAgent({ ...current, ...(await readJson(request)) })
      const empty = emptyFields(agent)
      if (empty) return send(response, 400, { error: empty })
      return send(response, 200, { agent: store.updateAgent(params.id, agent) })
    }

    if ((params = route("GET", "api/conversations/:id"))) {
      const conversation = store.getConversation(params.id)
      if (!conversation) {
        return send(response, 404, { error: "no such conversation" })
      }
      const agents = agentIdsOf(conversation.id).flatMap((agentId) => {
        const agent = store.getAgent(agentId)
        if (!agent) return []
        return [{ ...agent, state: liveState(agentId, conversation.id) }]
      })
      return send(response, 200, { conversation, agents })
    }

    if (route("GET", "api/conversations")) {
      return send(response, 200, { conversations: store.listConversations() })
    }

    if (route("POST", "api/conversations")) {
      const body = await readJson(request)
      if (body.kind === "group" || body.kind === "channel") {
        const agents = texts(body.agentIds).flatMap(
          (agentId) => store.getAgent(agentId) ?? []
        )
        const members = [
          "user:me",
          ...agents.map((agent) => `agent:${agent.id}`),
        ]
        if (body.kind === "group") {
          if (agents.length === 0) {
            return send(response, 400, { error: "Give one or more agentIds." })
          }
          const conversation = store.createConversation({
            kind: "group",
            name: agents.map((agent) => agent.name).join(", "),
            topic: null,
            private: true,
            replyMode: "mention",
            members,
          })
          return send(response, 201, { conversation })
        }
        const name = text(body.name).trim()
        if (name === "") {
          return send(response, 400, { error: "Give the channel a name." })
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
          return send(response, 400, {
            error:
              "Use only lowercase letters, numbers and hyphens in a channel name.",
          })
        }
        const taken = store
          .listConversations()
          .some((item) => item.kind === "channel" && item.name === name)
        if (taken) {
          return send(response, 409, {
            error: `A channel with the name ${name} exists.`,
          })
        }
        const conversation = store.createConversation({
          kind: "channel",
          name,
          topic: text(body.topic).trim() || null,
          private: body.private === true,
          replyMode: body.replyMode === "every" ? "every" : "mention",
          members,
        })
        return send(response, 201, { conversation })
      }
      const agent = store.getAgent(text(body.agentId))
      if (body.kind !== "dm" || !agent) {
        return send(response, 400, { error: "Give kind dm and an agentId." })
      }
      const existing = store.findDirectMessage(agent.id)
      if (existing) return send(response, 200, { conversation: existing })
      const conversation = store.createConversation({
        kind: "dm",
        name: agent.name,
        topic: null,
        private: true,
        replyMode: "every",
        members: ["user:me", `agent:${agent.id}`],
      })
      return send(response, 201, { conversation })
    }

    send(response, 404, { error: "not found" })
  }

  return {
    listen(port: number): Promise<{ host: string; port: number }> {
      return new Promise((resolve) => {
        http.listen(port, HOST, () => {
          const address = http.address() as AddressInfo
          resolve({ host: address.address, port: address.port })
        })
      })
    },
    async close(): Promise<void> {
      await Promise.all(
        [...live.values()].map((session) => session.handle?.stop())
      )
      for (const channel of channels.values()) {
        for (const client of channel.clients) client.end()
      }
      await new Promise<void>((resolve) => http.close(() => resolve()))
    },
  }
}

function toNewAgent(body: Record<string, unknown>): NewAgent {
  return {
    name: text(body.name),
    colour: text(body.colour),
    model: text(body.model),
    permissionMode: text(body.permissionMode),
    cwd: text(body.cwd),
    autostart: body.autostart === true,
    allowedTools: texts(body.allowedTools),
    disallowedTools: texts(body.disallowedTools),
    systemPrompt:
      typeof body.systemPrompt === "string" && body.systemPrompt !== ""
        ? body.systemPrompt
        : null,
  }
}

function emptyFields(agent: NewAgent): string | null {
  const empty = (["name", "cwd", "model", "permissionMode"] as const).filter(
    (field) => agent[field].trim() === ""
  )
  return empty.length > 0
    ? `These fields are empty: ${empty.join(", ")}.`
    : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function matchRoute(
  method: string | undefined,
  parts: string[],
  wantedMethod: string,
  pattern: string
): Record<string, string> | null {
  if (method !== wantedMethod) return null
  const pieces = pattern.split("/")
  if (pieces.length !== parts.length) return null
  const params: Record<string, string> = {}
  for (const [index, piece] of pieces.entries()) {
    if (piece.startsWith(":")) {
      params[piece.slice(1)] = decodeURIComponent(parts[index])
    } else if (piece !== parts[index]) {
      return null
    }
  }
  return params
}

function permissionAnswer(
  card: PermissionItem | QuestionItem,
  body: Record<string, unknown>
): PermissionAnswer {
  if (card.kind === "question") {
    return {
      behavior: "allow",
      updatedInput: { questions: card.questions, answers: body.answers ?? {} },
    }
  }
  if (body.decision === "allow_once") {
    return { behavior: "allow", updatedInput: card.input }
  }
  if (body.decision === "always_allow") {
    return {
      behavior: "allow",
      updatedInput: card.input,
      updatedPermissions: card.suggestions,
    }
  }
  return { behavior: "deny", message: "The user denied this." }
}

function writeEvent(response: ServerResponse, event: StreamEvent) {
  response.write(`id: ${event.id}\ndata: ${event.data}\n\n`)
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}

async function readJson(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error("body too large")
    chunks.push(chunk as Buffer)
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {}
}
