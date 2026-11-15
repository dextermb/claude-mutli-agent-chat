import { afterEach, describe, expect, test, vi } from "vitest"
import {
  openAppEvents,
  openEvents,
  postJson,
  promptsTo,
  runCleanups,
  sendMessage,
  startServer,
  testRunner,
  timeline,
} from "../test/http.ts"

afterEach(runCleanups)

async function createAgent(base: string, name: string) {
  const response = await postJson(base, "/api/agents", {
    ...testRunner,
    name,
  })
  return ((await response.json()) as { agent: { id: string } }).agent
}

async function groupChat(base: string, agentIds: string[]) {
  const response = await postJson(base, "/api/conversations", {
    kind: "group",
    agentIds,
  })
  return ((await response.json()) as { conversation: { id: string } })
    .conversation
}

async function channel(base: string, body: Record<string, unknown>) {
  const response = await postJson(base, "/api/conversations", {
    kind: "channel",
    name: "release-train",
    ...body,
  })
  return ((await response.json()) as { conversation: { id: string } })
    .conversation
}

async function changeSettings(
  base: string,
  conversationId: string,
  body: unknown
) {
  return fetch(`${base}/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function untilTurns(base: string, conversationId: string, count: number) {
  await vi.waitFor(async () => {
    const { items } = await timeline(base, conversationId)
    expect(items.filter(({ item }) => item.kind === "turn")).toHaveLength(count)
  })
}

describe("group chats and channels", () => {
  test("an agent added to a group chat joins its members and its name, and both streams say so", async () => {
    const { base } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const writer = await createAgent(base, "docs-writer")
    const group = await groupChat(base, [reviewer.id, runner.id])
    const stream = openEvents(base, group.id)
    const app = openAppEvents(base)
    await Promise.all([stream.ready, app.ready])

    const response = await postJson(
      base,
      `/api/conversations/${group.id}/members`,
      {
        agentIds: [writer.id],
      }
    )

    expect(response.status).toBe(200)
    const { conversation } = (await response.json()) as {
      conversation: { name: string; members: string[] }
    }
    expect(conversation).toMatchObject({
      name: "reviewer-bot, test-runner, docs-writer",
      members: [
        "user:me",
        `agent:${reviewer.id}`,
        `agent:${runner.id}`,
        `agent:${writer.id}`,
      ],
    })
    await vi.waitFor(() => {
      expect(stream.events.map(({ data }) => data)).toEqual([
        { type: "conversation", conversation },
      ])
      expect(app.events.map(({ data }) => data)).toEqual([
        { type: "conversation", conversation },
      ])
    })
  })

  test("stop turn for one agent interrupts that agent and not the other", async () => {
    const { base, sentTo } = await startServer("interrupt")
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])
    const stream = openEvents(base, group.id)
    await stream.ready
    await sendMessage(
      base,
      group.id,
      "@reviewer-bot @test-runner write a long story."
    )
    await vi.waitFor(() =>
      expect(
        stream.events.filter(
          ({ data }) => data.type === "agent_state" && data.state === "busy"
        )
      ).toHaveLength(2)
    )

    const response = await postJson(
      base,
      `/api/conversations/${group.id}/agents/${reviewer.id}/stop`,
      {}
    )

    expect(response.status).toBe(202)
    const interrupts = (name: string) =>
      (sentTo.get(name) ?? []).filter(
        (line) =>
          line.type === "control_request" &&
          (line.request as { subtype: string }).subtype === "interrupt"
      )
    await vi.waitFor(() => expect(interrupts("reviewer-bot")).toHaveLength(1))
    expect(interrupts("test-runner")).toHaveLength(0)
  })

  test("a group chat with two agents takes their names, and its reply mode is mention", async () => {
    const { base } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")

    const response = await postJson(base, "/api/conversations", {
      kind: "group",
      agentIds: [reviewer.id, runner.id],
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      conversation: expect.objectContaining({
        kind: "group",
        name: "reviewer-bot, test-runner",
        private: true,
        replyMode: "mention",
        members: ["user:me", `agent:${reviewer.id}`, `agent:${runner.id}`],
      }),
    })
  })

  test("a channel takes the name, topic, privacy and reply mode that the user gives", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")

    const response = await postJson(base, "/api/conversations", {
      kind: "channel",
      name: "release-train",
      topic: "Ship v2.4 on Friday.",
      private: false,
      replyMode: "every",
      agentIds: [runner.id],
    })
    const missingName = await postJson(base, "/api/conversations", {
      kind: "channel",
      name: " ",
      agentIds: [runner.id],
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      conversation: expect.objectContaining({
        kind: "channel",
        name: "release-train",
        topic: "Ship v2.4 on Friday.",
        private: false,
        replyMode: "every",
        members: ["user:me", `agent:${runner.id}`],
      }),
    })
    expect(missingName.status).toBe(400)
  })

  test("an agent in a channel starts with the rule of that channel, its topic and its members", async () => {
    const { base, started } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const created = await postJson(base, "/api/conversations", {
      kind: "channel",
      name: "release-train",
      topic: "Ship v2.4 on Friday.",
      agentIds: [reviewer.id, runner.id],
    })
    const { conversation } = (await created.json()) as {
      conversation: { id: string }
    }

    await sendMessage(base, conversation.id, "@test-runner run the tests.")
    await untilTurns(base, conversation.id, 1)

    const rule = started[0][started[0].indexOf("--append-system-prompt") + 1]
    expect(rule).toContain(
      [
        '- You are the agent "test-runner".',
        `- This conversation is the channel "#release-train" (ID "${conversation.id}"). Its topic: "Ship v2.4 on Friday.".`,
        "- An agent gets a turn when a message mentions it with @name. If your message holds a question mark, the next message of the user with no mention also comes to you.",
        "- The members at the start: User, reviewer-bot, test-runner (you).",
      ].join("\n")
    )
    expect(rule).toMatch(/\n\nYou run and fix the Vitest tests\.$/)
  })

  test("in a group chat, only the agent that the message mentions gets a turn", async () => {
    const { base, startedAgents } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@test-runner run the tests.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "Thank you, both.")
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(startedAgents).toEqual(["test-runner"])
  })

  test("in a channel with every message mode, each agent gets a turn for a message with no mention", async () => {
    const { base, startedAgents } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const created = await postJson(base, "/api/conversations", {
      kind: "channel",
      name: "release-train",
      replyMode: "every",
      agentIds: [reviewer.id, runner.id],
    })
    const { conversation } = (await created.json()) as {
      conversation: { id: string }
    }

    await sendMessage(base, conversation.id, "The release branch is cut.")
    await untilTurns(base, conversation.id, 2)

    expect([...startedAgents].sort()).toEqual(["reviewer-bot", "test-runner"])
  })

  test("a mentioned agent gets each message since its last turn, each with its author", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) =>
        name === "reviewer-bot"
          ? { reply: "The key is on a fragment." }
          : { reply: "I added the test." }
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot look at PR 212.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "@test-runner add a test for it.")
    await untilTurns(base, group.id, 2)
    await sendMessage(base, group.id, "@test-runner thank you.")
    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "test-runner")).toHaveLength(2)
    )

    expect(promptsTo(sentTo, "test-runner")).toEqual([
      [
        "[User] @reviewer-bot look at PR 212.",
        "[reviewer-bot] The key is on a fragment.",
        "[User] @test-runner add a test for it.",
      ].join("\n"),
      "[User] @test-runner thank you.",
    ])
  })

  test("after a new session, the first prompt holds only the messages after the divider", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "Done." })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])
    await sendMessage(base, group.id, "@test-runner run the tests.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "@reviewer-bot look at PR 212.")
    await untilTurns(base, group.id, 2)

    await postJson(
      base,
      `/api/conversations/${group.id}/agents/${runner.id}/sessions`,
      {}
    )
    await sendMessage(base, group.id, "@test-runner add a test for it.")

    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "test-runner")).toEqual([
        "[User] @test-runner run the tests.",
        "[User] @test-runner add a test for it.",
      ])
    )
  })

  test("a removed agent stops its process, and leaves the members and the name of the group chat", async () => {
    const { base } = await startServer("interrupt")
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])
    const stream = openEvents(base, group.id)
    await stream.ready
    await sendMessage(base, group.id, "@test-runner write a long story.")
    const statesOf = (agentId: string) =>
      stream.events.flatMap(({ data }) =>
        data.type === "agent_state" && data.agentId === agentId
          ? [data.state]
          : []
      )
    await vi.waitFor(() => expect(statesOf(runner.id)).toContain("busy"))

    const response = await fetch(
      `${base}/api/conversations/${group.id}/members/${runner.id}`,
      { method: "DELETE" }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      conversation: {
        name: "reviewer-bot",
        members: ["user:me", `agent:${reviewer.id}`],
      },
    })
    await vi.waitFor(() => expect(statesOf(runner.id).at(-1)).toBe("exited"))
  })

  test("a DM refuses a change of members, and a group chat keeps its last agent", async () => {
    const { base, agent, conversation } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [runner.id])

    const add = await postJson(
      base,
      `/api/conversations/${conversation.id}/members`,
      {
        agentIds: [runner.id],
      }
    )
    const removeFromDm = await fetch(
      `${base}/api/conversations/${conversation.id}/members/${agent.id}`,
      { method: "DELETE" }
    )
    const removeLast = await fetch(
      `${base}/api/conversations/${group.id}/members/${runner.id}`,
      { method: "DELETE" }
    )

    expect([add.status, removeFromDm.status, removeLast.status]).toEqual([
      400, 400, 400,
    ])
    expect(await removeLast.json()).toEqual({
      error: "A group chat needs one agent or more.",
    })
  })

  test("the first prompt of a new member holds only the messages after it joined", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "Done." })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const writer = await createAgent(base, "docs-writer")
    const group = await groupChat(base, [reviewer.id, runner.id])
    await sendMessage(base, group.id, "@reviewer-bot look at PR 212.")
    await untilTurns(base, group.id, 1)

    await postJson(base, `/api/conversations/${group.id}/members`, {
      agentIds: [writer.id],
    })
    await sendMessage(base, group.id, "@docs-writer write the release notes.")

    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "docs-writer")).toEqual([
        "[User] @docs-writer write the release notes.",
      ])
    )
  })

  test("a mention in the reply of an agent starts a turn for the other agent", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) =>
        name === "reviewer-bot"
          ? { reply: "@test-runner please add a test for the 404 page." }
          : { reply: "I added the test." }
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot review PR 212.")
    await untilTurns(base, group.id, 2)

    expect(promptsTo(sentTo, "test-runner")).toEqual([
      [
        "[User] @reviewer-bot review PR 212.",
        "[reviewer-bot] @test-runner please add a test for the 404 page.",
      ].join("\n"),
    ])
  })

  test("an agent that asks a question gets the next message of the user with no mention", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) =>
        name === "reviewer-bot"
          ? { reply: "Which branch do you want me to review?" }
          : { reply: "I ran the tests." }
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot review PR 212.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "The release branch.")
    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(2)
    )

    expect(promptsTo(sentTo, "reviewer-bot")).toEqual([
      "[User] @reviewer-bot review PR 212.",
      "[User] The release branch.",
    ])
    expect(promptsTo(sentTo, "test-runner")).toEqual([])
  })

  test("a message that mentions another agent does not go to the agent that asked a question", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) =>
        name === "reviewer-bot"
          ? { reply: "Which branch do you want me to review?" }
          : { reply: "I ran the tests." }
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot review PR 212.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "@test-runner which branch is it?")
    await untilTurns(base, group.id, 2)

    expect(promptsTo(sentTo, "reviewer-bot")).toEqual([
      "[User] @reviewer-bot review PR 212.",
    ])
  })

  test("an agent gets no turn for a second message after the user answered its question", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "Which branch do you want me to review?" })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot review PR 212.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "The release branch.")
    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(2)
    )
    await sendMessage(base, group.id, "Thank you, both.")
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(2)
  })

  test("stop removes a prompt that the mention of an agent put in the queue of a busy agent", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) =>
        name === "reviewer-bot"
          ? { reply: "@test-runner add a test for the 404 page." }
          : { fixture: "interrupt" }
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])
    await sendMessage(base, group.id, "@test-runner write a long story.")
    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "test-runner")).toHaveLength(1)
    )
    await sendMessage(base, group.id, "@reviewer-bot review PR 212.")
    await untilTurns(base, group.id, 1)

    await postJson(base, `/api/conversations/${group.id}/stop`, {})

    await untilTurns(base, group.id, 2)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(promptsTo(sentTo, "test-runner")).toHaveLength(1)
    const { items } = await timeline(base, group.id)
    expect(
      items
        .filter(({ item }) => item.kind === "turn")
        .map(({ item }) => item.status)
    ).toEqual(["done", "stopped"])
  })

  test("the list of agents gives the most urgent state of each agent over its conversations", async () => {
    const { base } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) => (name === "test-runner" ? { fixture: "interrupt" } : {})
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@test-runner @reviewer-bot start.")
    await untilTurns(base, group.id, 1)

    const listed = (await (await fetch(`${base}/api/agents`)).json()) as {
      agents: { id: string; name: string; state: string }[]
    }
    expect(
      listed.agents
        .filter(({ id }) => id === reviewer.id || id === runner.id)
        .map(({ name, state }) => ({ name, state }))
    ).toEqual([
      { name: "reviewer-bot", state: "idle" },
      { name: "test-runner", state: "busy" },
    ])
  })

  test("a channel name with other characters than lowercase letters, numbers and hyphens is refused", async () => {
    const { base } = await startServer()

    const response = await postJson(base, "/api/conversations", {
      kind: "channel",
      name: "Release Train",
      agentIds: [],
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error:
        "Use only lowercase letters, numbers and hyphens in a channel name.",
      fields: {
        name: "Use only lowercase letters, numbers and hyphens in a channel name.",
      },
    })
  })

  test("a second channel with the name of a channel that exists is refused", async () => {
    const { base } = await startServer()
    const channel = { kind: "channel", name: "release-train", agentIds: [] }
    await postJson(base, "/api/conversations", channel)

    const again = await postJson(base, "/api/conversations", channel)

    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({
      error: "A channel with the name release-train exists.",
    })
  })

  test("a change to the settings of a channel keeps the fields that it does not name, and both streams say so", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const created = await channel(base, {
      topic: "Ship v2.4 on Friday.",
      agentIds: [runner.id],
    })
    const stream = openEvents(base, created.id)
    const app = openAppEvents(base)
    await Promise.all([stream.ready, app.ready])

    const response = await changeSettings(base, created.id, {
      private: true,
      replyMode: "every",
    })

    expect(response.status).toBe(200)
    const { conversation } = (await response.json()) as {
      conversation: Record<string, unknown>
    }
    expect(conversation).toMatchObject({
      kind: "channel",
      name: "release-train",
      topic: "Ship v2.4 on Friday.",
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${runner.id}`],
    })
    await vi.waitFor(() => {
      expect(stream.events.map(({ data }) => data)).toEqual([
        { type: "conversation", conversation },
      ])
      expect(app.events.map(({ data }) => data)).toEqual([
        { type: "conversation", conversation },
      ])
    })
  })

  test("a DM and a group chat refuse a change to the settings", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [runner.id])
    const dm = await postJson(base, "/api/conversations", {
      kind: "dm",
      agentId: runner.id,
    })
    const { conversation: direct } = (await dm.json()) as {
      conversation: { id: string }
    }

    const toGroup = await changeSettings(base, group.id, { replyMode: "every" })
    const toDirect = await changeSettings(base, direct.id, { topic: "Tests" })

    for (const response of [toGroup, toDirect]) {
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: "Only a channel has settings.",
      })
    }
    expect(
      await (await fetch(`${base}/api/conversations/${group.id}`)).json()
    ).toMatchObject({
      conversation: { replyMode: "mention" },
    })
  })

  test("a channel refuses a reply mode that does not exist, and keeps its settings", async () => {
    const { base } = await startServer()
    const created = await channel(base, { agentIds: [] })

    const response = await changeSettings(base, created.id, {
      replyMode: "sometimes",
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Pick a reply mode.",
      fields: { replyMode: "Pick a reply mode." },
    })
    expect(
      await (await fetch(`${base}/api/conversations/${created.id}`)).json()
    ).toMatchObject({ conversation: { replyMode: "mention" } })
  })

  test("after a change to every message, each agent gets the next message with no mention", async () => {
    const { base, startedAgents } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const created = await channel(base, {
      agentIds: [reviewer.id, runner.id],
    })

    await changeSettings(base, created.id, { replyMode: "every" })
    await sendMessage(base, created.id, "The release branch is cut.")
    await untilTurns(base, created.id, 2)

    expect([...startedAgents].sort()).toEqual(["reviewer-bot", "test-runner"])
  })
})
