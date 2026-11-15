import { homedir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
  callChat,
  openAppEvents,
  postChat,
  promptsTo,
  runCleanups,
  sendMessage,
  startServer,
  testRunner,
  timeline,
} from "../test/http.ts"

afterEach(runCleanups)

function toolValue(body: Record<string, unknown> | null) {
  const result = body?.result as { content: { text: string }[] }
  return JSON.parse(result.content[0].text) as unknown
}

async function startedAgent() {
  const server = await startServer()
  await sendMessage(server.base, server.conversation.id, "Reply with ok.")
  await vi.waitFor(async () => {
    const { items } = await timeline(server.base, server.conversation.id)
    expect(items.some(({ item }) => item.kind === "turn")).toBe(true)
  })
  return { ...server, args: server.started[0] }
}

describe("the chat MCP server", () => {
  test("an agent session opens the chat server with its token, and a wrong token is refused", async () => {
    const { args } = await startedAgent()

    const opened = await callChat(args, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "claude-code", version: "2.1.311" },
    })
    const refused = await callChat(args, "initialize", {}, "Bearer wrong")

    expect(opened.status).toBe(200)
    expect(opened.body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "chat", version: "0.1.0" },
      },
    })
    expect(refused.status).toBe(403)
  })

  test("the chat server takes a notification with no answer, refuses a method that it does not know, and has no event stream", async () => {
    const { args } = await startedAgent()

    const notification = await postChat(args, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    })
    const discover = await callChat(args, "server/discover")
    const ping = await callChat(args, "ping")
    const stream = await postChat(args, {}, undefined, "GET")

    expect(notification).toEqual({ status: 202, body: null })
    expect(discover.body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found: server/discover" },
    })
    expect(ping.body).toEqual({ jsonrpc: "2.0", id: 1, result: {} })
    expect(stream.status).toBe(405)
  })

  test("the chat server lists its tools, each with a description and the schema of its input", async () => {
    const { args } = await startedAgent()

    const { body } = await callChat(args, "tools/list")

    const tools = (body?.result as { tools: Record<string, unknown>[] }).tools
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_conversation",
      "list_conversations",
      "list_agents",
      "read_messages",
      "send_message",
      "start_conversation",
      "add_members",
    ])
    expect(tools.find((tool) => tool.name === "get_conversation")).toEqual({
      name: "get_conversation",
      description: expect.stringContaining("conversation"),
      inputSchema: expect.objectContaining({
        type: "object",
        properties: {
          conversationId: expect.objectContaining({ type: "string" }),
        },
      }),
    })
  })

  test("an agent reads its own conversation, with each member and the state of each agent", async () => {
    const { args, agent, conversation } = await startedAgent()

    const { body } = await callChat(args, "tools/call", {
      name: "get_conversation",
      arguments: {},
    })

    expect(toolValue(body)).toEqual({
      id: conversation.id,
      kind: "dm",
      name: "reviewer-bot",
      topic: null,
      replyMode: "every",
      folder: null,
      thisConversation: true,
      members: [
        { name: "User", kind: "user" },
        { name: agent.name, kind: "agent", state: "idle", you: true },
      ],
    })
  })

  test("an agent reads the folder of a channel, with the home folder as ~", async () => {
    const { args, store, agent } = await startedAgent()
    const channel = store.createConversation({
      kind: "channel",
      name: "billing-api",
      topic: null,
      private: false,
      replyMode: "mention",
      cwd: join(homedir(), "code", "billing-api"),
      members: ["user:me", `agent:${agent.id}`],
    })

    const { body } = await callChat(args, "tools/call", {
      name: "get_conversation",
      arguments: { conversationId: channel.id },
    })

    expect(toolValue(body)).toMatchObject({
      name: "billing-api",
      folder: "~/code/billing-api",
    })
  })

  test("a generic agent shows in the list of agents with no folder", async () => {
    const { args, store } = await startedAgent()
    store.createAgent({ ...testRunner, cwd: null })

    const { body } = await callChat(args, "tools/call", {
      name: "list_agents",
      arguments: {},
    })

    expect(toolValue(body)).toContainEqual({
      name: "test-runner",
      state: "exited",
      folder: null,
      you: false,
    })
  })

  test("an agent cannot read a conversation where it is not a member", async () => {
    const { args, store } = await startedAgent()
    const runner = store.createAgent(testRunner)
    const other = store.createConversation({
      kind: "dm",
      name: runner.name,
      topic: null,
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${runner.id}`],
    })

    const { body } = await callChat(args, "tools/call", {
      name: "get_conversation",
      arguments: { conversationId: other.id },
    })

    expect(body?.result).toEqual({
      content: [
        {
          type: "text",
          text: `You are not a member of the conversation "${other.id}".`,
        },
      ],
      isError: true,
    })
  })

  test("an agent lists the conversations where it is a member, and only those", async () => {
    const { args, store, agent, conversation } = await startedAgent()
    const runner = store.createAgent(testRunner)
    const channel = store.createConversation({
      kind: "channel",
      name: "frontend",
      topic: "The web app",
      private: false,
      replyMode: "mention",
      members: ["user:me", `agent:${agent.id}`, `agent:${runner.id}`],
    })
    store.createConversation({
      kind: "dm",
      name: runner.name,
      topic: null,
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${runner.id}`],
    })

    const { body } = await callChat(args, "tools/call", {
      name: "list_conversations",
      arguments: {},
    })

    expect(toolValue(body)).toEqual([
      {
        id: conversation.id,
        kind: "dm",
        name: "reviewer-bot",
        topic: null,
        thisConversation: true,
      },
      {
        id: channel.id,
        kind: "channel",
        name: "frontend",
        topic: "The web app",
        thisConversation: false,
      },
    ])
  })

  test("an agent lists each agent with its state and its folder, with the home folder as ~", async () => {
    const { args, store } = await startedAgent()
    store.createAgent({
      ...testRunner,
      cwd: join(homedir(), "code", "web-app"),
    })

    const { body } = await callChat(args, "tools/call", {
      name: "list_agents",
      arguments: {},
    })

    expect(toolValue(body)).toEqual([
      {
        name: "reviewer-bot",
        state: "idle",
        folder: expect.any(String),
        you: true,
      },
      {
        name: "test-runner",
        state: "exited",
        folder: "~/code/web-app",
        you: false,
      },
    ])
  })

  test("an agent reads the messages of a conversation a page at a time, oldest first", async () => {
    const { args, store, conversation } = await startedAgent()
    const first = store.addUserMessage(conversation.id, "First note.")
    const second = store.addUserMessage(conversation.id, "Second note.")

    const latest = await callChat(args, "tools/call", {
      name: "read_messages",
      arguments: { limit: 2 },
    })
    const older = await callChat(args, "tools/call", {
      name: "read_messages",
      arguments: { before: first.seq, limit: 5 },
    })

    expect(toolValue(latest.body)).toEqual({
      messages: [
        {
          seq: first.seq,
          author: "User",
          at: first.createdAt,
          text: "First note.",
        },
        {
          seq: second.seq,
          author: "User",
          at: second.createdAt,
          text: "Second note.",
        },
      ],
      more: true,
    })
    expect(toolValue(older.body)).toEqual({
      messages: [
        expect.objectContaining({ author: "User", text: "Reply with ok." }),
        expect.objectContaining({ author: "reviewer-bot", text: "ok" }),
      ],
      more: false,
    })
  })

  test("an agent sends a message to another conversation, and the agent that it mentions gets a turn there", async () => {
    const { base, args, store, agent, sentTo } = await startedAgent()
    const runner = store.createAgent(testRunner)
    const channel = store.createConversation({
      kind: "channel",
      name: "frontend",
      topic: null,
      private: false,
      replyMode: "mention",
      members: ["user:me", `agent:${agent.id}`, `agent:${runner.id}`],
    })

    const { body } = await callChat(args, "tools/call", {
      name: "send_message",
      arguments: {
        conversationId: channel.id,
        text: "@test-runner run the tests.",
      },
    })

    expect(toolValue(body)).toEqual({ seq: expect.any(Number) })
    await vi.waitFor(async () => {
      const { items } = await timeline(base, channel.id)
      expect(
        items.map(({ authorKey, item }) => [authorKey, item.kind, item.text])
      ).toEqual([
        [`agent:${agent.id}`, "message", "@test-runner run the tests."],
        [`agent:${runner.id}`, "message", "ok"],
        [`agent:${runner.id}`, "turn", undefined],
      ])
    })
    expect(promptsTo(sentTo, "test-runner")).toEqual([
      "[reviewer-bot] @test-runner run the tests.",
    ])
  })

  test("an agent sends a progress message to its own conversation, and the message stays after a rebuild of its session", async () => {
    const { base, args, store, agent, conversation } = await startedAgent()

    await callChat(args, "tools/call", {
      name: "send_message",
      arguments: { text: "Halfway: the build passes." },
    })
    const empty = await callChat(args, "tools/call", {
      name: "send_message",
      arguments: { text: "  " },
    })
    const session = store.latestSession(agent.id, conversation.id)
    store.rebuildTimeline(String(session?.id))

    const { items } = await timeline(base, conversation.id)
    expect(items.at(-1)).toMatchObject({
      authorKey: `agent:${agent.id}`,
      item: { kind: "message", text: "Halfway: the build passes." },
    })
    expect(empty.body?.result).toMatchObject({
      content: [
        { type: "text", text: expect.stringContaining("Write a message.") },
      ],
      isError: true,
    })
  })

  test("an agent starts a group chat with another agent, and its first message gives that agent a turn", async () => {
    const { base, args, store, agent } = await startedAgent()
    const runner = store.createAgent(testRunner)
    const app = openAppEvents(base)
    await app.ready

    const { body } = await callChat(args, "tools/call", {
      name: "start_conversation",
      arguments: {
        kind: "group",
        agentNames: ["test-runner"],
        text: "@test-runner is the date test flaky?",
      },
    })

    const started = toolValue(body) as { conversationId: string }
    expect(started).toEqual({
      conversationId: expect.any(String),
      kind: "group",
      name: "reviewer-bot, test-runner",
      seq: expect.any(Number),
    })
    await vi.waitFor(async () => {
      const { items } = await timeline(base, started.conversationId)
      expect(
        items.map(({ authorKey, item }) => [authorKey, item.kind, item.text])
      ).toEqual([
        [
          `agent:${agent.id}`,
          "message",
          "@test-runner is the date test flaky?",
        ],
        [`agent:${runner.id}`, "message", "ok"],
        [`agent:${runner.id}`, "turn", undefined],
      ])
    })
    expect(app.events.map(({ data }) => data)).toContainEqual({
      type: "conversation",
      conversation: expect.objectContaining({
        id: started.conversationId,
        members: ["user:me", `agent:${agent.id}`, `agent:${runner.id}`],
      }),
    })
  })

  test("an agent cannot start a conversation with an unknown agent, or a channel with a name that the chat app refuses", async () => {
    const { args, store } = await startedAgent()
    store.createAgent(testRunner)

    const unknown = await callChat(args, "tools/call", {
      name: "start_conversation",
      arguments: { kind: "group", agentNames: ["ghost"], text: "Hello." },
    })
    const badName = await callChat(args, "tools/call", {
      name: "start_conversation",
      arguments: {
        kind: "channel",
        name: "Front End",
        agentNames: ["test-runner"],
        text: "Hello.",
      },
    })

    expect(unknown.body?.result).toEqual({
      content: [{ type: "text", text: 'No agent has the name "ghost".' }],
      isError: true,
    })
    expect(badName.body?.result).toEqual({
      content: [
        {
          type: "text",
          text: "Use only lowercase letters, numbers and hyphens in a channel name.",
        },
      ],
      isError: true,
    })
    expect(store.listConversations()).toHaveLength(1)
  })

  test("an agent adds another agent to a channel, and cannot add an agent to a DM", async () => {
    const { base, args, store, agent, conversation } = await startedAgent()
    const runner = store.createAgent(testRunner)
    const channel = store.createConversation({
      kind: "channel",
      name: "frontend",
      topic: null,
      private: false,
      replyMode: "mention",
      members: ["user:me", `agent:${agent.id}`],
    })

    const added = await callChat(args, "tools/call", {
      name: "add_members",
      arguments: { conversationId: channel.id, agentNames: ["test-runner"] },
    })
    const toDm = await callChat(args, "tools/call", {
      name: "add_members",
      arguments: {
        conversationId: conversation.id,
        agentNames: ["test-runner"],
      },
    })

    expect(toolValue(added.body)).toEqual({
      name: "frontend",
      members: ["User", "reviewer-bot", "test-runner"],
    })
    const response = await fetch(`${base}/api/conversations/${channel.id}`)
    expect(
      ((await response.json()) as { conversation: { members: string[] } })
        .conversation.members
    ).toEqual(["user:me", `agent:${agent.id}`, `agent:${runner.id}`])
    expect(toDm.body?.result).toEqual({
      content: [{ type: "text", text: "A DM has one agent." }],
      isError: true,
    })
  })

  test("a new session gets a new token, and the token of the old process is refused", async () => {
    const { base, args, started, agent, conversation } = await startedAgent()

    await fetch(
      `${base}/api/conversations/${conversation.id}/agents/${agent.id}/sessions`,
      { method: "POST" }
    )
    await vi.waitFor(() => expect(started).toHaveLength(2))

    const old = await callChat(args, "ping")
    const renewed = await callChat(started[1], "ping")
    expect(old.status).toBe(403)
    expect(renewed.body).toEqual({ jsonrpc: "2.0", id: 1, result: {} })
  })
})
