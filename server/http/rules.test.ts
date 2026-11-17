import { afterEach, describe, expect, test, vi } from "vitest"
import {
  factsTo,
  postJson,
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

async function createConversation(base: string, body: Record<string, unknown>) {
  const response = await postJson(base, "/api/conversations", body)
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

function rulesTo(
  sentTo: Map<string, Record<string, unknown>[]>,
  agentName: string
) {
  return factsTo(sentTo, agentName).flatMap((note) =>
    note.split(/\n(?=\[Chat app\] )/).filter((part) => /\brules\b/.test(part))
  )
}

describe("the rules of a conversation", () => {
  test("a channel keeps the rules that the user saves", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "channel",
      name: "review",
      agentIds: [runner.id],
    })

    const response = await changeSettings(base, id, {
      rules: "Do not edit files.\nWrite findings only.",
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      conversation: { rules: "Do not edit files.\nWrite findings only." },
    })
  })

  test("a group chat keeps the rules that the user saves", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "group",
      agentIds: [runner.id],
    })

    const response = await changeSettings(base, id, {
      rules: "Reply in French.",
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      conversation: { rules: "Reply in French." },
    })
  })

  test("rules over 4,000 characters are refused, and the channel keeps its rules", async () => {
    const { base } = await startServer()
    const { id } = await createConversation(base, {
      kind: "channel",
      name: "review",
      rules: "Write findings only.",
    })

    const response = await changeSettings(base, id, {
      rules: "x".repeat(4001),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Keep the rules to 4,000 characters or fewer.",
      fields: { rules: "Keep the rules to 4,000 characters or fewer." },
    })
    expect(
      await (await fetch(`${base}/api/conversations/${id}`)).json()
    ).toMatchObject({ conversation: { rules: "Write findings only." } })
  })

  test("an agent gets the rules after the facts in its first prompt, and not again while they stay the same", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ fixture: "max-turns", reply: "Done." })
    )
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "channel",
      name: "review",
      rules: "Do not edit files.\nWrite findings only.",
      agentIds: [runner.id],
    })

    await sendMessage(base, id, "@test-runner look at PR 212.")
    await untilTurns(base, id, 1)
    await sendMessage(base, id, "@test-runner and PR 213.")
    await untilTurns(base, id, 2)

    const rules =
      "[Chat app] The rules of this channel, from the user:\nDo not edit files.\nWrite findings only."
    expect(factsTo(sentTo, "test-runner")[0]).toMatch(/^\[Chat app\] This session:\n/)
    expect(factsTo(sentTo, "test-runner")[0].endsWith(`\n${rules}`)).toBe(true)
    expect(rulesTo(sentTo, "test-runner")).toEqual([rules])
  })

  test("a running agent of a group chat with no rules gets the new rules with its next prompt", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ fixture: "max-turns", reply: "Done." })
    )
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "group",
      agentIds: [runner.id],
    })
    await sendMessage(base, id, "@test-runner look at PR 212.")
    await untilTurns(base, id, 1)

    await changeSettings(base, id, { rules: "Reply in French." })
    await sendMessage(base, id, "@test-runner and PR 213.")
    await untilTurns(base, id, 2)

    expect(rulesTo(sentTo, "test-runner")).toEqual([
      "[Chat app] The rules of this group chat, from the user:\nReply in French.",
    ])
  })

  test("a running agent learns with its next prompt that the user removed the rules", async () => {
    const { base, sentTo } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({ fixture: "max-turns", reply: "Done." })
    )
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "channel",
      name: "review",
      rules: "Write findings only.",
      agentIds: [runner.id],
    })
    await sendMessage(base, id, "@test-runner look at PR 212.")
    await untilTurns(base, id, 1)

    await changeSettings(base, id, { rules: "" })
    await sendMessage(base, id, "@test-runner and PR 213.")
    await untilTurns(base, id, 2)

    expect(rulesTo(sentTo, "test-runner").slice(1)).toEqual([
      "[Chat app] The user removed the rules of this channel.",
    ])
  })

  test("an agent that resumes its Claude session after the user removed the rules learns that they do not apply", async () => {
    const { base, started, sentTo } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "channel",
      name: "review",
      rules: "Write findings only.",
      agentIds: [runner.id],
    })
    await sendMessage(base, id, "@test-runner look at PR 212.")
    await untilTurns(base, id, 1)
    await postJson(base, `/api/agents/${runner.id}/stop`, {})
    await changeSettings(base, id, { rules: "" })

    await sendMessage(base, id, "@test-runner and PR 213.")
    await untilTurns(base, id, 2)

    expect(started[1]).toContain("--resume")
    expect(rulesTo(sentTo, "test-runner")).toEqual([
      "[Chat app] The rules of this channel, from the user:\nWrite findings only.",
      "[Chat app] This channel has no rules now. Do not follow rules from an earlier prompt.",
    ])
  })

  test("after a compaction, the next prompt gives the rules in full again", async () => {
    const { base, sentTo } = await startServer("compact")
    const runner = await createAgent(base, "test-runner")
    const { id } = await createConversation(base, {
      kind: "channel",
      name: "review",
      rules: "Write findings only.",
      agentIds: [runner.id],
    })
    await sendMessage(base, id, "@test-runner look at PR 212.")
    await untilTurns(base, id, 1)
    await sendMessage(base, id, "@test-runner /compact")
    await untilTurns(base, id, 2)

    await sendMessage(base, id, "@test-runner and PR 213.")
    await untilTurns(base, id, 3)

    const rules =
      "[Chat app] The rules of this channel, from the user:\nWrite findings only."
    expect(rulesTo(sentTo, "test-runner")).toEqual([rules, rules])
  })
})
