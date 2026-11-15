import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, describe, expect, test, vi } from "vitest"
import { decodeLine } from "../protocol/decode.ts"
import { readFixture } from "../test/fixtures.ts"
import { SCHEMA_V1 } from "../test/schema-v1.ts"
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
  vi.useRealTimers()
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

function versionOneFile() {
  const folder = mkdtempSync(join(tmpdir(), "store-test-"))
  folders.push(folder)
  const file = join(folder, "agents.db")
  const db = new DatabaseSync(file)
  db.exec(SCHEMA_V1)
  db.exec(
    `INSERT INTO agents VALUES ('a1', 'reviewer-bot', 'aqua', 'claude-haiku-5-5',
       'default', '/home/user/projects/app', 0, '[]', '[]', NULL,
       '2026-11-15T10:00:00.000Z');
     INSERT INTO conversations VALUES ('c1', 'dm', 'reviewer-bot', NULL, 1,
       'every', '2026-11-15T10:00:00.000Z');
     INSERT INTO agent_sessions VALUES ('s1', 'a1', 'c1',
       '9a966a23-de85-473e-b54f-ea449c292221', 'exited',
       '2026-11-15T10:00:00.000Z');`
  )
  return { file, db }
}

function openFile(file: string): Store {
  const store = openStore(file)
  stores.push(store)
  return store
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

  test("a member that joins goes to the end of the list, and keeps the place of the timeline where it joined", () => {
    const store = memoryStore()
    const first = store.createAgent(reviewer)
    const second = store.createAgent({ ...reviewer, name: "test-runner" })
    const third = store.createAgent({ ...reviewer, name: "docs-writer" })
    const group = store.createConversation({
      kind: "group",
      name: "reviewer-bot, test-runner",
      topic: null,
      private: true,
      replyMode: "mention",
      members: ["user:me", `agent:${first.id}`, `agent:${second.id}`],
    })
    const message = store.addUserMessage(group.id, "Hello.")

    store.removeMember(group.id, `agent:${first.id}`)
    store.addMember(group.id, `agent:${third.id}`)
    store.addMember(group.id, `agent:${first.id}`)

    expect(store.getConversation(group.id)?.members).toEqual([
      "user:me",
      `agent:${second.id}`,
      `agent:${third.id}`,
      `agent:${first.id}`,
    ])
    expect(store.joinedSeq(group.id, `agent:${first.id}`)).toBe(message.seq)
    expect(store.joinedSeq(group.id, `agent:${second.id}`)).toBe(0)
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

  test("each timeline entry has the time when it was first stored", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const store = memoryStore()
    const { conversation, session } = directMessage(store)

    vi.setSystemTime(new Date("2026-11-15T14:03:00.000Z"))
    store.addUserMessage(
      conversation.id,
      "Remember the word kiwi. Reply with the single word ok."
    )
    vi.setSystemTime(new Date("2026-11-15T14:04:30.000Z"))
    playLive(store, session.id, "resume-1")
    vi.setSystemTime(new Date("2026-11-15T15:00:00.000Z"))
    store.rebuildTimeline(session.id)

    expect(
      store
        .listTimeline(conversation.id)
        .map(({ item, createdAt }) => [item.kind, createdAt])
    ).toEqual([
      ["message", "2026-11-15T14:03:00.000Z"],
      ["message", "2026-11-15T14:04:30.000Z"],
      ["turn", "2026-11-15T14:04:30.000Z"],
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

  test("a database of version 1 gets the exit columns, and keeps its rows", () => {
    const { file, db } = versionOneFile()
    db.close()

    const store = openFile(file)
    store.updateSession("s1", {
      endedAt: "2026-11-15T10:05:00.000Z",
      exitCode: 1,
      stderr: "Error: the hook failed\n",
    })

    expect(store.getSession("s1")).toMatchObject({
      id: "s1",
      agentId: "a1",
      conversationId: "c1",
      claudeSessionId: "9a966a23-de85-473e-b54f-ea449c292221",
      state: "exited",
      startedAt: "2026-11-15T10:00:00.000Z",
      endedAt: "2026-11-15T10:05:00.000Z",
      exitCode: 1,
      stderr: "Error: the hook failed\n",
    })
  })

  test("a database of version 1 gets its timelines built again, so each turn shows its own cost", () => {
    const { file, db } = versionOneFile()
    const insert = db.prepare(
      `INSERT INTO session_events (session_id, seq, direction, line, at)
       VALUES ('s1', ?, ?, ?, '2026-11-15T10:01:00.000Z')`
    )
    fixtureLines("background").forEach((line, index) =>
      insert.run(index + 1, line.direction, line.text)
    )
    db.close()

    const turns = openFile(file)
      .listTimeline("c1")
      .flatMap(({ item }) => (item.kind === "turn" ? [item.costUsd] : []))

    expect(turns).toHaveLength(2)
    expect(turns[0]).toBeCloseTo(0.00843574, 10)
    expect(turns[1]).toBeCloseTo(0.00068716, 10)
  })

  test("a session keeps the configuration that its process started with, and whether its Claude session is new", () => {
    const { file, db } = versionOneFile()
    db.close()
    const store = openFile(file)
    const config = {
      model: "claude-haiku-5-5",
      permissionMode: "default",
      cwd: "/home/user/projects/app",
      allowedTools: ["Read"],
      disallowedTools: [],
      systemPrompt: null,
    }

    const created = store.createSession({
      agentId: "a1",
      conversationId: "c1",
      claudeSessionId: "0f3c2b8e-5d1a-4c6e-9b7f-2a4d6e8c0b1d",
      claudeSessionNew: true,
      config,
    })
    store.updateSession(created.id, { claudeSessionNew: false })

    expect(store.getSession("s1")).toMatchObject({
      config: null,
      claudeSessionNew: false,
    })
    expect(store.getSession(created.id)).toMatchObject({
      claudeSessionId: "0f3c2b8e-5d1a-4c6e-9b7f-2a4d6e8c0b1d",
      claudeSessionNew: false,
      config,
    })
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
