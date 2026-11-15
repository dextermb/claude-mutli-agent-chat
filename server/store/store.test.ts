import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import { decodeLine } from "../protocol/decode.ts"
import { readFixture } from "../test/fixtures.ts"
import { emptyTimeline, reduceTimeline } from "../timeline/reduce.ts"
import { openStore, type NewAgent, type Store } from "./store.ts"

const reviewer: NewAgent = {
  name: "reviewer-bot",
  colour: "aqua",
  model: "claude-haiku-5-5",
  permissionMode: "default",
  cwd: "/home/user/projects/app",
  autostart: false,
  allowedTools: ["Read", "Bash(git *)"],
  disallowedTools: ["WebFetch"],
  systemPrompt: "You review pull requests.",
}

const stores: Store[] = []
const folders: string[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true })
})

function restartableStore() {
  const folder = mkdtempSync(join(tmpdir(), "store-test-"))
  folders.push(folder)
  const file = join(folder, "agents.db")
  const before = openStore(file)
  stores.push(before)
  return {
    before,
    restart: () => {
      before.close()
      stores.splice(stores.indexOf(before), 1)
      const after = openStore(file)
      stores.push(after)
      return after
    },
  }
}

function memoryStore(): Store {
  const store = openStore(":memory:")
  stores.push(store)
  return store
}

function directMessage(store: Store) {
  const agent = store.createAgent(reviewer)
  const conversation = store.createConversation({
    kind: "dm",
    name: "reviewer-bot",
    topic: null,
    private: true,
    replyMode: "every",
    members: ["user:me", `agent:${agent.id}`],
  })
  const session = store.createSession({
    agentId: agent.id,
    conversationId: conversation.id,
  })
  return { agent, conversation, session }
}

function fixtureLines(name: string) {
  return readFixture(name).map(({ dir, line }) => ({
    direction: dir,
    text: JSON.stringify(line),
  }))
}

function playLive(
  store: Store,
  sessionId: string,
  fixture: string,
  lines = fixtureLines(fixture)
) {
  let timeline = emptyTimeline()
  for (const line of lines) {
    const seq = store.recordLine(sessionId, line.direction, line.text)
    if (line.direction === "in") continue
    const step = reduceTimeline(timeline, decodeLine(line.text))
    timeline = step.state
    store.saveItems(sessionId, step.changes, seq)
  }
}

describe("Store", () => {
  test("an agent can be created and read back with its configuration", () => {
    const store = memoryStore()

    const created = store.createAgent(reviewer)

    expect(store.getAgent(created.id)).toEqual({
      id: created.id,
      createdAt: created.createdAt,
      name: "reviewer-bot",
      colour: "aqua",
      model: "claude-haiku-5-5",
      permissionMode: "default",
      cwd: "/home/user/projects/app",
      autostart: false,
      allowedTools: ["Read", "Bash(git *)"],
      disallowedTools: ["WebFetch"],
      systemPrompt: "You review pull requests.",
    })
  })

  test("a conversation can be created with its members and read back", () => {
    const store = memoryStore()
    const agent = store.createAgent(reviewer)

    const created = store.createConversation({
      kind: "dm",
      name: "reviewer-bot",
      topic: null,
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${agent.id}`],
    })

    expect(store.getConversation(created.id)).toEqual({
      id: created.id,
      createdAt: created.createdAt,
      kind: "dm",
      name: "reviewer-bot",
      topic: null,
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${agent.id}`],
    })
  })

  test("the lines of a session are stored in the order that they came", () => {
    const store = memoryStore()
    const { session } = directMessage(store)

    for (const line of fixtureLines("resume-1")) {
      store.recordLine(session.id, line.direction, line.text)
    }

    expect(
      store
        .listLines(session.id)
        .map(({ direction, text }) => ({ direction, text }))
    ).toEqual(fixtureLines("resume-1"))
  })

  test("a second change to a timeline item replaces the stored item", () => {
    const store = memoryStore()
    const { conversation, session } = directMessage(store)

    playLive(store, session.id, "resume-1")

    expect(
      store.listTimeline(conversation.id).map((entry) => entry.item)
    ).toEqual([
      expect.objectContaining({ kind: "message", text: "ok", status: "done" }),
      expect.objectContaining({ kind: "turn", status: "done" }),
    ])
  })

  test("the timeline of a conversation loads in order with the author of each item", () => {
    const store = memoryStore()
    const { agent, conversation, session } = directMessage(store)

    store.addUserMessage(
      conversation.id,
      "Remember the word kiwi. Reply with the single word ok."
    )
    playLive(store, session.id, "resume-1")

    expect(
      store.listTimeline(conversation.id).map(({ authorKey, item }) => ({
        authorKey,
        kind: item.kind,
        text: item.kind === "message" ? item.text : null,
      }))
    ).toEqual([
      {
        authorKey: "user:me",
        kind: "message",
        text: "Remember the word kiwi. Reply with the single word ok.",
      },
      { authorKey: `agent:${agent.id}`, kind: "message", text: "ok" },
      { authorKey: `agent:${agent.id}`, kind: "turn", text: null },
    ])
  })

  test("the timeline built again from the stored lines equals the stored timeline", () => {
    const store = memoryStore()
    const { conversation, session } = directMessage(store)
    store.addUserMessage(conversation.id, "Do these steps in order.")
    playLive(store, session.id, "tools")
    store.addUserMessage(conversation.id, "Thank you.")
    const stored = store.listTimeline(conversation.id)

    store.rebuildTimeline(session.id)

    expect(store.listTimeline(conversation.id)).toEqual(stored)
    expect(stored).toHaveLength(13)
  })

  test("a question that is open when the server stops is expired when the server starts again", () => {
    const { before, restart } = restartableStore()
    const { conversation, session } = directMessage(before)
    const lines = fixtureLines("question")
    const request = lines.findIndex((line) =>
      line.text.includes('"subtype":"can_use_tool"')
    )
    playLive(before, session.id, "question", lines.slice(0, request + 1))

    const after = restart()

    expect(
      after
        .listTimeline(conversation.id)
        .map(({ item }) => ({ kind: item.kind, status: item.status }))
    ).toEqual([{ kind: "question", status: "expired" }])
  })

  test("a request that expired stays expired when the timeline is built again", () => {
    const { before, restart } = restartableStore()
    const { conversation, session } = directMessage(before)
    const lines = fixtureLines("question")
    const request = lines.findIndex((line) =>
      line.text.includes('"subtype":"can_use_tool"')
    )
    playLive(before, session.id, "question", lines.slice(0, request + 1))
    const after = restart()

    after.rebuildTimeline(session.id)

    expect(
      after
        .listTimeline(conversation.id)
        .map(({ item }) => ({ kind: item.kind, status: item.status }))
    ).toEqual([{ kind: "question", status: "expired" }])
  })

  test("a session keeps its Claude session id and its state for the next start", () => {
    const store = memoryStore()
    const { session } = directMessage(store)

    store.updateSession(session.id, {
      claudeSessionId: "7e27a04a-8178-4a22-aad9-d886c125c430",
      state: "idle",
    })

    expect(store.getSession(session.id)).toMatchObject({
      claudeSessionId: "7e27a04a-8178-4a22-aad9-d886c125c430",
      state: "idle",
    })
  })

  test("a session that was live when the server stopped is exited when the server starts again", () => {
    const { before, restart } = restartableStore()
    const { session } = directMessage(before)
    before.updateSession(session.id, { state: "busy" })

    const after = restart()

    expect(after.getSession(session.id)?.state).toBe("exited")
  })
})
