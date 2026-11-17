import { afterEach, describe, expect, test } from "vitest"
import {
  postJson,
  runCleanups,
  startServer,
  testRunner,
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
})
