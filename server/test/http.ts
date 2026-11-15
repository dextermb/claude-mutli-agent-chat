import { expect, vi } from "vitest"
import { AgentSession } from "../session/session.ts"
import {
  openStore,
  type Agent,
  type Conversation,
  type Store,
} from "../store/store.ts"
import { createServer, type StartSession } from "../http/server.ts"

const FAKE_CLAUDE = new URL("./fake-claude.ts", import.meta.url).pathname

export const cleanups: (() => Promise<void>)[] = []

export async function runCleanups() {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
}

export type Members = { agent: Agent; conversation: Conversation }

export type FakeAgent = { fixture?: string; reply?: string; mode?: string }

export async function startServer(
  fixture = "resume-1",
  location = ":memory:",
  members?: Members,
  perAgent: (agentName: string) => FakeAgent = () => ({}),
  options: { eventLogSize?: number } = {}
) {
  const store = openStore(location)
  const started: string[][] = []
  const startedAgents: string[] = []
  const sent: Record<string, unknown>[] = []
  const sentTo = new Map<string, Record<string, unknown>[]>()
  const startSession: StartSession = ({ agent, args, onEvent }) => {
    started.push(args)
    startedAgents.push(agent.name)
    const fake = perAgent(agent.name)
    const session = new AgentSession({
      command: process.execPath,
      args: [FAKE_CLAUDE, ...args],
      cwd: process.cwd(),
      env: {
        ...process.env,
        FAKE_CLAUDE_FIXTURE: fake.fixture ?? fixture,
        FAKE_CLAUDE_MODE: fake.mode ?? "play",
        ...(fake.reply === undefined ? {} : { FAKE_CLAUDE_REPLY: fake.reply }),
      },
      onEvent: (event) => {
        if (event.type === "line" && event.direction === "in") {
          const line = JSON.parse(event.text) as Record<string, unknown>
          sent.push(line)
          sentTo.set(agent.name, [...(sentTo.get(agent.name) ?? []), line])
        }
        onEvent(event)
      },
    })
    session.start()
    return session
  }
  const server = createServer({ store, startSession, ...options })
  const address = await server.listen(0)
  const stop = async () => {
    await server.close()
    store.close()
  }
  cleanups.push(stop)
  const { agent, conversation } = members ?? directMessage(store)
  const base = `http://${address.host}:${address.port}`
  return {
    base,
    store,
    started,
    startedAgents,
    sent,
    sentTo,
    agent,
    conversation,
    address,
    stop,
    server,
  }
}

export function directMessage(store: Store): Members {
  const agent = store.createAgent({
    name: "reviewer-bot",
    colour: "aqua",
    model: "claude-haiku-5-5",
    permissionMode: "default",
    cwd: process.cwd(),
    autostart: false,
    allowedTools: [],
    disallowedTools: [],
    systemPrompt: null,
  })
  const conversation = store.createConversation({
    kind: "dm",
    name: "reviewer-bot",
    topic: null,
    private: true,
    replyMode: "every",
    members: ["user:me", `agent:${agent.id}`],
  })
  return { agent, conversation }
}

export async function sendMessage(
  base: string,
  conversationId: string,
  text: string
) {
  return fetch(`${base}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  })
}

export async function timeline(base: string, conversationId: string) {
  const response = await fetch(
    `${base}/api/conversations/${conversationId}/timeline`
  )
  return (await response.json()) as {
    items: { authorKey: string; item: Record<string, unknown> }[]
    lastEventId: number
  }
}

export type StreamEvent = { id: number; data: Record<string, unknown> }

export function openEvents(
  base: string,
  conversationId: string,
  lastEventId?: number,
  sendIdIn: "header" | "query" = "header"
) {
  return openStream(
    `${base}/api/conversations/${conversationId}/events`,
    lastEventId,
    sendIdIn
  )
}

export function openAppEvents(base: string, lastEventId?: number) {
  return openStream(`${base}/api/events`, lastEventId, "header")
}

function openStream(
  route: string,
  lastEventId: number | undefined,
  sendIdIn: "header" | "query"
) {
  const events: StreamEvent[] = []
  const lines: StreamEvent[] = []
  const abort = new AbortController()
  const headers: Record<string, string> = {}
  let address = route
  if (lastEventId !== undefined && sendIdIn === "header") {
    headers["last-event-id"] = String(lastEventId)
  }
  if (lastEventId !== undefined && sendIdIn === "query") {
    address += `?lastEventId=${lastEventId}`
  }
  const response = fetch(address, {
    headers,
    signal: abort.signal,
  })
  const opened = response.then(async (response) => {
    const reader = response.body
      ?.pipeThrough(new TextDecoderStream())
      .getReader()
    let buffer = ""
    for (;;) {
      const chunk = await reader?.read()
      if (!chunk || chunk.done) return
      buffer += chunk.value
      const blocks = buffer.split("\n\n")
      buffer = blocks.pop() ?? ""
      for (const block of blocks) {
        const fields = Object.fromEntries(
          block
            .split("\n")
            .filter((line) => line.includes(": "))
            .map((line) => [
              line.slice(0, line.indexOf(": ")),
              line.slice(line.indexOf(": ") + 2),
            ])
        )
        if (fields.data) {
          const event = { id: Number(fields.id), data: JSON.parse(fields.data) }
          if (event.data.type === "line") lines.push(event)
          else events.push(event)
        }
      }
    }
  })
  const close = async () => {
    abort.abort()
    await opened.catch(() => undefined)
  }
  cleanups.push(close)
  return { events, lines, close, ready: response.then(() => undefined) }
}

export function agentStates(events: StreamEvent[]) {
  return events.flatMap(({ data }) =>
    data.type === "agent_state" ? [data.state] : []
  )
}

export function streamedItems(events: StreamEvent[]) {
  return events.flatMap(({ data }) => {
    if (data.type !== "item") return []
    const entry = data.entry as { item: Record<string, unknown> }
    return [[entry.item.kind, entry.item.status, entry.item.text]]
  })
}

export async function postJson(base: string, route: string, body: unknown) {
  return fetch(`${base}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export const testRunner = {
  name: "test-runner",
  colour: "aqua",
  model: "claude-sonnet-5-5",
  permissionMode: "acceptEdits",
  cwd: "/home/user/code/web-app",
  autostart: true,
  allowedTools: ["Read", "Bash(pnpm test:*)"],
  disallowedTools: ["WebFetch"],
  systemPrompt: "You run and fix the Vitest tests.",
}

export async function answerRequest(
  base: string,
  requestId: string,
  body: Record<string, unknown>
) {
  return fetch(`${base}/api/requests/${requestId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function nextPendingCard(base: string, conversationId: string) {
  let requestId = ""
  await vi.waitFor(async () => {
    const { items } = await timeline(base, conversationId)
    const card = items.find(({ item }) => item.status === "pending")
    expect(card).toBeDefined()
    requestId = String(card?.item.requestId)
  })
  return requestId
}

export function promptsTo(
  sentTo: Map<string, Record<string, unknown>[]>,
  agentName: string
): string[] {
  return (sentTo.get(agentName) ?? [])
    .filter((line) => line.type === "user")
    .map((line) => {
      const message = line.message as { content: { text: string }[] }
      return message.content.map((block) => block.text).join("")
    })
}

export function chatServerOf(args: string[]) {
  const config = JSON.parse(args[args.indexOf("--mcp-config") + 1]) as {
    mcpServers: {
      chat: { url: string; headers: { Authorization: string } }
    }
  }
  return config.mcpServers.chat
}

export async function callChat(
  args: string[],
  method: string,
  params: Record<string, unknown> = {},
  authorization = chatServerOf(args).headers.Authorization
) {
  return postChat(
    args,
    { jsonrpc: "2.0", id: 1, method, params },
    authorization
  )
}

export async function postChat(
  args: string[],
  message: Record<string, unknown>,
  authorization = chatServerOf(args).headers.Authorization,
  method = "POST"
) {
  const response = await fetch(chatServerOf(args).url, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization,
    },
    body: method === "POST" ? JSON.stringify(message) : undefined,
  })
  const text = await response.text()
  return {
    status: response.status,
    body: (text === "" ? null : JSON.parse(text)) as Record<
      string,
      unknown
    > | null,
  }
}
