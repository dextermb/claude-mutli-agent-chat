import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"
import type { PermissionAnswer } from "../protocol/encode.ts"
import { buildArgs } from "../session/args.ts"
import type { PermissionItem, QuestionItem } from "../timeline/reduce.ts"
import type { SessionEvent, SessionState } from "../session/session.ts"
import type { SessionRow, Store } from "../store/store.ts"

export type SessionHandle = {
  prompt(text: string): void
  answer(requestId: string, answer: PermissionAnswer): void
  interrupt(): void
  stop(): Promise<void>
}

export type StartSession = (options: {
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
}

type StreamEvent = { id: number; data: string }

type Channel = {
  nextId: number
  log: StreamEvent[]
  clients: Set<ServerResponse>
}

const HOST = "127.0.0.1"
const MAX_BODY_BYTES = 1_000_000

export function createServer({ store, startSession }: ServerOptions) {
  const live = new Map<string, LiveSession>()
  const channels = new Map<string, Channel>()
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

  function liveSessionFor(agentId: string, conversationId: string) {
    for (const session of live.values()) {
      if (
        session.agentId === agentId &&
        session.conversationId === conversationId
      ) {
        return session
      }
    }
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
    }
    live.set(session.id, session)
    session.handle = startSession({
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
      if (event.state === "exited" || event.state === "failed") {
        live.delete(session.id)
      }
    }
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

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "conversations" &&
      parts[3] === "messages"
    ) {
      if (!store.getConversation(parts[2])) {
        return send(response, 404, { error: "no such conversation" })
      }
      const body = await readJson(request)
      const text = typeof body.text === "string" ? body.text : ""
      const entry = store.addUserMessage(parts[2], text)
      publish(parts[2], { type: "item", entry })
      for (const agentId of agentIdsOf(parts[2])) {
        const session = liveSessionFor(agentId, parts[2])
        if (session) deliver(session, text)
      }
      return send(response, 202, { entry })
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "conversations" &&
      parts[3] === "timeline"
    ) {
      return send(response, 200, {
        items: store.listTimeline(parts[2]),
        lastEventId: channelOf(parts[2]).nextId - 1,
      })
    }

    if (
      request.method === "GET" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "conversations" &&
      parts[3] === "events"
    ) {
      const channel = channelOf(parts[2])
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      })
      response.flushHeaders()
      const lastEventId = Number(request.headers["last-event-id"])
      if (Number.isInteger(lastEventId)) {
        for (const event of channel.log) {
          if (event.id > lastEventId) writeEvent(response, event)
        }
      }
      channel.clients.add(response)
      request.on("close", () => channel.clients.delete(response))
      return
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "conversations" &&
      parts[3] === "stop"
    ) {
      for (const session of live.values()) {
        if (session.conversationId !== parts[2]) continue
        session.queue = []
        if (session.state === "busy" || session.state === "waiting") {
          session.handle?.interrupt()
        }
      }
      return send(response, 202, {})
    }

    if (
      request.method === "POST" &&
      parts.length === 3 &&
      parts[0] === "api" &&
      parts[1] === "requests"
    ) {
      const open = openRequests.get(parts[2])
      if (!open) return send(response, 404, { error: "no open request" })
      const body = await readJson(request)
      open.session.handle?.answer(parts[2], permissionAnswer(open.card, body))
      return send(response, 202, {})
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
