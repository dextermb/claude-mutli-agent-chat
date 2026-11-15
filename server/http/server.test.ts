import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import { AgentSession } from "../session/session.ts"
import {
  openStore,
  type Agent,
  type Conversation,
  type Store,
} from "../store/store.ts"
import { createServer, type StartSession } from "./server.ts"

const FAKE_CLAUDE = new URL("../test/fake-claude.ts", import.meta.url).pathname

const cleanups: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

type Members = { agent: Agent; conversation: Conversation }

async function startServer(
  fixture = "resume-1",
  location = ":memory:",
  members?: Members
) {
  const store = openStore(location)
  const started: string[][] = []
  const sent: Record<string, unknown>[] = []
  const startSession: StartSession = ({ args, onEvent }) => {
    started.push(args)
    const session = new AgentSession({
      command: process.execPath,
      args: [FAKE_CLAUDE, ...args],
      cwd: process.cwd(),
      env: {
        ...process.env,
        FAKE_CLAUDE_FIXTURE: fixture,
        FAKE_CLAUDE_MODE: "play",
      },
      onEvent: (event) => {
        if (event.type === "line" && event.direction === "in") {
          sent.push(JSON.parse(event.text) as Record<string, unknown>)
        }
        onEvent(event)
      },
    })
    session.start()
    return session
  }
  const server = createServer({ store, startSession })
  const address = await server.listen(0)
  const stop = async () => {
    await server.close()
    store.close()
  }
  cleanups.push(stop)
  const { agent, conversation } = members ?? directMessage(store)
  const base = `http://${address.host}:${address.port}`
  return { base, store, started, sent, agent, conversation, address, stop }
}

function directMessage(store: Store): Members {
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

async function sendMessage(base: string, conversationId: string, text: string) {
  return fetch(`${base}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  })
}

async function timeline(base: string, conversationId: string) {
  const response = await fetch(
    `${base}/api/conversations/${conversationId}/timeline`
  )
  return (await response.json()) as {
    items: { authorKey: string; item: Record<string, unknown> }[]
    lastEventId: number
  }
}

type StreamEvent = { id: number; data: Record<string, unknown> }

function openEvents(
  base: string,
  conversationId: string,
  lastEventId?: number
) {
  const events: StreamEvent[] = []
  const abort = new AbortController()
  const headers: Record<string, string> = {}
  if (lastEventId !== undefined) headers["last-event-id"] = String(lastEventId)
  const response = fetch(`${base}/api/conversations/${conversationId}/events`, {
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
          events.push({ id: Number(fields.id), data: JSON.parse(fields.data) })
        }
      }
    }
  })
  const close = async () => {
    abort.abort()
    await opened.catch(() => undefined)
  }
  cleanups.push(close)
  return { events, close, ready: response.then(() => undefined) }
}

function agentStates(events: StreamEvent[]) {
  return events.flatMap(({ data }) =>
    data.type === "agent_state" ? [data.state] : []
  )
}

function streamedItems(events: StreamEvent[]) {
  return events.flatMap(({ data }) => {
    if (data.type !== "item") return []
    const entry = data.entry as { item: Record<string, unknown> }
    return [[entry.item.kind, entry.item.status, entry.item.text]]
  })
}

async function answerRequest(
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

async function nextPendingCard(base: string, conversationId: string) {
  let requestId = ""
  await vi.waitFor(async () => {
    const { items } = await timeline(base, conversationId)
    const card = items.find(({ item }) => item.status === "pending")
    expect(card).toBeDefined()
    requestId = String(card?.item.requestId)
  })
  return requestId
}

describe("createServer", () => {
  test("a message that the user sends is stored and shows in the timeline", async () => {
    const { base, conversation } = await startServer()

    const response = await sendMessage(
      base,
      conversation.id,
      "Remember the word kiwi. Reply with the single word ok."
    )

    expect(response.status).toBe(202)
    expect((await timeline(base, conversation.id)).items[0]).toMatchObject({
      authorKey: "user:me",
      item: {
        kind: "message",
        text: "Remember the word kiwi. Reply with the single word ok.",
      },
    })
  })

  test("a message starts the agent, and the reply of the agent shows in the timeline", async () => {
    const { base, agent, conversation } = await startServer()

    await sendMessage(
      base,
      conversation.id,
      "Remember the word kiwi. Reply with the single word ok."
    )

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(
        items.map(({ authorKey, item }) => [authorKey, item.kind, item.text])
      ).toEqual([
        [
          "user:me",
          "message",
          "Remember the word kiwi. Reply with the single word ok.",
        ],
        [`agent:${agent.id}`, "message", "ok"],
        [`agent:${agent.id}`, "turn", undefined],
      ])
    })
  })

  test("a message to an agent with a stored Claude session resumes that session", async () => {
    const { base, store, started, agent, conversation } = await startServer()
    const earlier = store.createSession({
      agentId: agent.id,
      conversationId: conversation.id,
    })
    store.updateSession(earlier.id, {
      claudeSessionId: "7e27a04a-8178-4a22-aad9-d886c125c430",
      state: "exited",
    })

    await sendMessage(base, conversation.id, "What was the word?")

    expect(started).toHaveLength(1)
    expect(started[0].slice(-2)).toEqual([
      "--resume",
      "7e27a04a-8178-4a22-aad9-d886c125c430",
    ])
  })

  test("a resumed session adds its items after the items of the earlier process", async () => {
    const folder = mkdtempSync(join(tmpdir(), "server-test-"))
    cleanups.unshift(async () => rmSync(folder, { recursive: true }))
    const file = join(folder, "agents.db")
    const first = await startServer("resume-1", file)
    await sendMessage(first.base, first.conversation.id, "Remember kiwi.")
    await vi.waitFor(async () => {
      const { items } = await timeline(first.base, first.conversation.id)
      expect(items.at(-1)?.item.kind).toBe("turn")
    })
    await first.stop()
    cleanups.splice(cleanups.indexOf(first.stop), 1)

    const second = await startServer("resume-1", file, first)
    await sendMessage(second.base, second.conversation.id, "What was it?")

    await vi.waitFor(async () => {
      const { items } = await timeline(second.base, second.conversation.id)
      expect(items.map(({ item }) => [item.kind, item.text])).toEqual([
        ["message", "Remember kiwi."],
        ["message", "ok"],
        ["turn", undefined],
        ["message", "What was it?"],
        ["message", "ok"],
        ["turn", undefined],
      ])
    })
  })

  test("the event stream sends each item change and each state change of the agent", async () => {
    const { base, conversation } = await startServer()
    const stream = openEvents(base, conversation.id)
    await stream.ready

    await sendMessage(base, conversation.id, "Remember kiwi.")

    await vi.waitFor(() =>
      expect(agentStates(stream.events)).toEqual([
        "starting",
        "idle",
        "busy",
        "idle",
      ])
    )
    expect(streamedItems(stream.events)).toEqual([
      ["message", "done", "Remember kiwi."],
      ["message", "streaming", "ok"],
      ["message", "done", "ok"],
      ["turn", "done", undefined],
    ])
  })

  test("a stream that connects again with Last-Event-ID gets each event that it did not get", async () => {
    const { base, conversation } = await startServer()
    const first = openEvents(base, conversation.id)
    await first.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(first.events)).toHaveLength(4))
    const lastSeen = first.events[2].id

    const again = openEvents(base, conversation.id, lastSeen)

    await vi.waitFor(() => expect(again.events).toEqual(first.events.slice(3)))
  })

  test("the timeline gives the id of the last event, so a stream from it misses nothing", async () => {
    const { base, conversation } = await startServer()
    const watcher = openEvents(base, conversation.id)
    await watcher.ready
    await sendMessage(base, conversation.id, "Remember kiwi.")
    await vi.waitFor(() => expect(agentStates(watcher.events)).toHaveLength(4))

    const { lastEventId } = await timeline(base, conversation.id)

    expect(lastEventId).toBe(watcher.events.at(-1)?.id)
  })

  test("the user can allow once, deny, or always allow a tool, and each card shows the answer", async () => {
    const { base, sent, conversation } = await startServer("tools")
    await sendMessage(base, conversation.id, "Do these steps in order.")

    for (const decision of ["allow_once", "deny", "always_allow"]) {
      const requestId = await nextPendingCard(base, conversation.id)
      const response = await answerRequest(base, requestId, { decision })
      expect(response.status).toBe(202)
    }

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(
        items
          .filter(({ item }) => item.kind === "permission")
          .map(({ item }) => [item.toolName, item.status])
      ).toEqual([
        ["Edit", "allowed"],
        ["Bash", "denied"],
        ["Write", "allowed"],
      ])
    })
    expect(
      sent
        .filter((line) => line.type === "control_response")
        .map((line) => (line.response as Record<string, unknown>).response)
    ).toEqual([
      {
        behavior: "allow",
        updatedInput: {
          file_path: "/private/tmp/claude-fixture/tools/notes.txt",
          old_string: "beta",
          new_string: "BETA",
          replace_all: false,
        },
      },
      { behavior: "deny", message: "The user denied this." },
      {
        behavior: "allow",
        updatedInput: {
          file_path: "/private/tmp/claude-fixture/tools/out.txt",
          content: "done",
        },
        updatedPermissions: [
          { type: "setMode", mode: "acceptEdits", destination: "session" },
        ],
      },
    ])
  })

  test("the user can answer a question, and the card keeps the answer", async () => {
    const { base, sent, conversation } = await startServer("question")
    await sendMessage(base, conversation.id, "Ask me which colour I prefer.")

    const requestId = await nextPendingCard(base, conversation.id)
    await answerRequest(base, requestId, {
      answers: { "Which colour do you prefer?": "Red" },
    })

    await vi.waitFor(async () => {
      const { items } = await timeline(base, conversation.id)
      expect(
        items.find(({ item }) => item.kind === "question")?.item
      ).toMatchObject({
        status: "answered",
        answers: { "Which colour do you prefer?": "Red" },
      })
    })
    expect(
      sent
        .filter((line) => line.type === "control_response")
        .map((line) => (line.response as Record<string, unknown>).response)
    ).toEqual([
      {
        behavior: "allow",
        updatedInput: {
          questions: [
            {
              question: "Which colour do you prefer?",
              header: "Colour",
              options: [
                { label: "Red", description: "Choose red." },
                { label: "Blue", description: "Choose blue." },
              ],
              multiSelect: false,
            },
          ],
          answers: { "Which colour do you prefer?": "Red" },
        },
      },
    ])
  })

  test("stop interrupts the busy agent and removes the prompts in its queue", async () => {
    const { base, sent, conversation } = await startServer("interrupt")
    const stream = openEvents(base, conversation.id)
    await stream.ready
    await sendMessage(base, conversation.id, "Write a long story.")
    await vi.waitFor(() => expect(agentStates(stream.events)).toContain("busy"))
    await sendMessage(base, conversation.id, "Then write a poem.")

    const response = await fetch(
      `${base}/api/conversations/${conversation.id}/stop`,
      { method: "POST" }
    )

    expect(response.status).toBe(202)
    await vi.waitFor(() =>
      expect(agentStates(stream.events).at(-1)).toBe("idle")
    )
    expect(streamedItems(stream.events).at(-1)).toEqual([
      "turn",
      "stopped",
      undefined,
    ])
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(sent.filter((line) => line.type === "user")).toHaveLength(1)
  })

  test("the server listens only on the local address", async () => {
    const { address } = await startServer()

    expect(address.host).toBe("127.0.0.1")
  })

  test("a message to a conversation that does not exist gives not found", async () => {
    const { base } = await startServer()

    const response = await sendMessage(base, "no-such-conversation", "Hello?")

    expect(response.status).toBe(404)
  })
})
