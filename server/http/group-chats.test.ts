import { afterEach, describe, expect, test, vi } from "vitest"
import {
  openAppEvents,
  factsTo,
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

  test("an agent in a channel learns the channel, its topic and its members from its first prompt, not from its system prompt", async () => {
    const { base, started, sentTo } = await startServer()
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

    expect(factsTo(sentTo, "test-runner")).toEqual([
      [
        "[Chat app] This session:",
        '- You are the agent "test-runner".',
        `- This conversation is the channel "#release-train" (ID "${conversation.id}"). Its topic: "Ship v2.4 on Friday.".`,
        "- An agent gets a turn when a message mentions it with @name. If your message asks a question and mentions no agent, the next message of the user with no mention also comes to you.",
        "- The members: User, reviewer-bot, test-runner (you).",
        "- You work in /home/user/code/web-app.",
      ].join("\n"),
    ])
    expect(promptsTo(sentTo, "test-runner")).toEqual([
      "[User] @test-runner run the tests.",
    ])
    const systemPrompt =
      started[0][started[0].indexOf("--append-system-prompt") + 1]
    expect(systemPrompt).not.toContain("release-train")
    expect(systemPrompt).toMatch(/\n\nYou run and fix the Vitest tests\.$/)
  })

  test("an agent that runs learns in its next prompt only the facts that changed", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ fixture: "max-turns", reply: "Done." })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const writer = await createAgent(base, "docs-writer")
    const { id } = await channel(base, { agentIds: [reviewer.id, runner.id] })
    await sendMessage(base, id, "@test-runner run the tests.")
    await untilTurns(base, id, 1)

    await postJson(base, `/api/conversations/${id}/members`, {
      agentIds: [writer.id],
    })
    await sendMessage(base, id, "@test-runner run them again.")
    await untilTurns(base, id, 2)

    expect(factsTo(sentTo, "test-runner").slice(1)).toEqual([
      [
        "[Chat app] This session changed:",
        "- The members: User, reviewer-bot, test-runner (you), docs-writer.",
      ].join("\n"),
    ])
    expect(promptsTo(sentTo, "test-runner")).toEqual([
      "[User] @test-runner run the tests.",
      "[User] @test-runner run them again.",
    ])
  })

  test("an agent that runs gets no facts in its next prompt when nothing changed", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ fixture: "max-turns", reply: "Done." })
    )
    const runner = await createAgent(base, "test-runner")
    const { id } = await channel(base, { agentIds: [runner.id] })
    await sendMessage(base, id, "@test-runner run the tests.")
    await untilTurns(base, id, 1)

    await sendMessage(base, id, "@test-runner run them again.")
    await untilTurns(base, id, 2)

    expect(promptsTo(sentTo, "test-runner")).toHaveLength(2)
    expect(factsTo(sentTo, "test-runner")).toHaveLength(1)
  })

  test("an agent that resumes its Claude session learns the facts of now, not the facts of its first process", async () => {
    const { base, started, sentTo } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const { id } = await channel(base, {
      topic: "Ship v2.4 on Friday.",
      agentIds: [runner.id],
    })
    await sendMessage(base, id, "@test-runner run the tests.")
    await untilTurns(base, id, 1)
    await changeSettings(base, id, { topic: "Ship v2.5 on Monday." })
    await postJson(base, `/api/agents/${runner.id}/stop`, {})

    await sendMessage(base, id, "@test-runner run them again.")
    await untilTurns(base, id, 2)

    expect(started[1]).toContain("--resume")
    expect(factsTo(sentTo, "test-runner")[1].split("\n")[2]).toBe(
      `- This conversation is the channel "#release-train" (ID "${id}"). Its topic: "Ship v2.5 on Monday.".`
    )
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

  test("a question mark with text straight after it, as in a query string, is not a question", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "The run is at https://ci.dev/runs?id=212 now." })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot start the CI run.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "Thank you, both.")
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(1)
  })

  test("a question mark with punctuation after it, as in optional chaining, is not a question", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "I changed it to user?.name in the header." })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot fix the header.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "Thank you, both.")
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(1)
  })

  test("a question mark inside Markdown emphasis is a question", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "**Which branch?** The tests _need it?_" })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot run the tests.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "The release branch.")

    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot")).toEqual([
        "[User] @reviewer-bot run the tests.",
        "[User] The release branch.",
      ])
    )
  })

  test("a question mark with a space after it is a question", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ reply: "Which branch? The tests need it." })
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot run the tests.")
    await untilTurns(base, group.id, 1)
    await sendMessage(base, group.id, "The release branch.")

    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot")).toEqual([
        "[User] @reviewer-bot run the tests.",
        "[User] The release branch.",
      ])
    )
  })

  test("a question that mentions another agent does not wait for the user", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      (name) =>
        name === "reviewer-bot"
          ? { reply: "@test-runner which branch is it?" }
          : { reply: "I ran the tests." }
    )
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])

    await sendMessage(base, group.id, "@reviewer-bot review PR 212.")
    await untilTurns(base, group.id, 2)
    await sendMessage(base, group.id, "Thank you, both.")
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(1)
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

  test("a channel keeps its own sleep time, and a time above 55 minutes is refused", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const created = await channel(base, { agentIds: [runner.id] })

    const kept = await changeSettings(base, created.id, {
      sleepAfterMinutes: 5,
    })
    const tooLong = await changeSettings(base, created.id, {
      sleepAfterMinutes: 56,
    })

    expect(await kept.json()).toMatchObject({
      conversation: { sleepAfterMinutes: 5 },
    })
    expect(tooLong.status).toBe(400)
    expect(await tooLong.json()).toMatchObject({
      fields: {
        sleepAfterMinutes:
          "Give a whole number from 0 to 55, or leave it empty.",
      },
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

  test("stop agent stops the processes of that agent in each conversation, and leaves the other agent alone", async () => {
    const { base } = await startServer()
    const reviewer = await createAgent(base, "reviewer-bot")
    const runner = await createAgent(base, "test-runner")
    const group = await groupChat(base, [reviewer.id, runner.id])
    const dm = (
      (await (
        await postJson(base, "/api/conversations", {
          kind: "dm",
          agentId: runner.id,
        })
      ).json()) as { conversation: { id: string } }
    ).conversation
    await sendMessage(base, group.id, "@reviewer-bot @test-runner hello.")
    await sendMessage(base, dm.id, "Run the tests.")
    await untilTurns(base, group.id, 2)
    await untilTurns(base, dm.id, 1)

    const response = await postJson(base, `/api/agents/${runner.id}/stop`, {})

    expect(response.status).toBe(202)
    const stateOf = async (agentId: string) => {
      const { agents } = (await (await fetch(`${base}/api/agents`)).json()) as {
        agents: { id: string; state: string }[]
      }
      return agents.find((agent) => agent.id === agentId)?.state
    }
    await vi.waitFor(async () =>
      expect(await stateOf(runner.id)).toBe("exited")
    )
    expect(await stateOf(reviewer.id)).toBe("idle")
  })

  test("stop agent for an agent that does not exist gives not found", async () => {
    const { base } = await startServer()

    const response = await postJson(base, "/api/agents/nobody/stop", {})

    expect(response.status).toBe(404)
  })

  test("restart session starts each process of the agent again with its Claude session and the new configuration", async () => {
    const { base, started } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const dm = (
      (await (
        await postJson(base, "/api/conversations", {
          kind: "dm",
          agentId: runner.id,
        })
      ).json()) as { conversation: { id: string } }
    ).conversation
    await sendMessage(base, dm.id, "Run the tests.")
    await untilTurns(base, dm.id, 1)
    const sessionCard = async () =>
      (
        (await (
          await fetch(
            `${base}/api/conversations/${dm.id}/agents/${runner.id}/session`
          )
        ).json()) as {
          session: { claudeSessionId: string; model: string; state: string }
        }
      ).session
    const before = await sessionCard()
    await fetch(`${base}/api/agents/${runner.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5" }),
    })

    const response = await postJson(
      base,
      `/api/agents/${runner.id}/restart`,
      {}
    )

    expect(response.status).toBe(202)
    expect(started).toHaveLength(2)
    const again = started[1]
    expect(again[again.indexOf("--resume") + 1]).toBe(before.claudeSessionId)
    expect(again[again.indexOf("--model") + 1]).toBe("claude-haiku-5-5")
    await vi.waitFor(async () =>
      expect(await sessionCard()).toMatchObject({
        claudeSessionId: before.claudeSessionId,
        model: "claude-haiku-5-5",
        configChanged: false,
      })
    )
  })
})
