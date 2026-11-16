import { existsSync } from "node:fs"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
  openAppEvents,
  postJson,
  runCleanups,
  sendMessage,
  startServer,
  testRunner,
} from "../test/http.ts"

afterEach(runCleanups)

async function createAgent(base: string, name: string) {
  const response = await postJson(base, "/api/agents", { ...testRunner, name })
  return ((await response.json()) as { agent: { id: string } }).agent
}

async function createConversation(base: string, body: Record<string, unknown>) {
  const response = await postJson(base, "/api/conversations", body)
  return ((await response.json()) as { conversation: { id: string } })
    .conversation
}

function remove(base: string, route: string) {
  return fetch(`${base}${route}`, { method: "DELETE" })
}

describe("delete", () => {
  test("a deleted channel stops the agent that works in it, and the app stream says that it is gone", async () => {
    const { base } = await startServer("interrupt")
    const runner = await createAgent(base, "test-runner")
    const channel = await createConversation(base, {
      kind: "channel",
      name: "release-train",
      agentIds: [runner.id],
    })
    const app = openAppEvents(base)
    await app.ready
    await sendMessage(base, channel.id, "@test-runner write a long story.")
    const states = () =>
      app.events.flatMap(({ data }) =>
        data.type === "agent_state" && data.agentId === runner.id
          ? [data.state]
          : []
      )
    await vi.waitFor(() => expect(states()).toContain("busy"))

    const response = await remove(base, `/api/conversations/${channel.id}`)

    expect(response.status).toBe(204)
    await vi.waitFor(() => expect(states().at(-1)).toBe("exited"))
    await vi.waitFor(() =>
      expect(app.events.map(({ data }) => data)).toContainEqual({
        type: "conversation_deleted",
        conversationId: channel.id,
      })
    )
    const read = await fetch(`${base}/api/conversations/${channel.id}`)
    expect(read.status).toBe(404)
  })

  test("a DM goes only with its agent, and an unknown conversation is not found", async () => {
    const { base, conversation } = await startServer()

    const dm = await remove(base, `/api/conversations/${conversation.id}`)
    const unknown = await remove(base, "/api/conversations/nothing")

    expect([dm.status, unknown.status]).toEqual([400, 404])
    expect(await dm.json()).toEqual({
      error: "A DM goes with its agent. Delete the agent.",
    })
  })

  test("a deleted group chat takes its uploaded files with it", async () => {
    const { base } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const group = await createConversation(base, {
      kind: "group",
      agentIds: [runner.id],
    })
    const upload = await fetch(
      `${base}/api/conversations/${group.id}/uploads?name=notes.txt`,
      { method: "PUT", body: "kiwi" }
    )
    const { path } = (await upload.json()) as { path: string }
    expect(existsSync(path)).toBe(true)

    await remove(base, `/api/conversations/${group.id}`)

    expect(existsSync(path)).toBe(false)
  })

  test("a deleted agent stops, its DM and its group chat go, and it leaves the channel", async () => {
    const { base, agent, conversation: dm } = await startServer("interrupt")
    const runner = await createAgent(base, "test-runner")
    const group = await createConversation(base, {
      kind: "group",
      agentIds: [agent.id],
    })
    const channel = await createConversation(base, {
      kind: "channel",
      name: "release-train",
      agentIds: [agent.id, runner.id],
    })
    const app = openAppEvents(base)
    await app.ready
    await sendMessage(base, dm.id, "Write a long story.")
    const states = () =>
      app.events.flatMap(({ data }) =>
        data.type === "agent_state" && data.agentId === agent.id
          ? [data.state]
          : []
      )
    await vi.waitFor(() => expect(states()).toContain("busy"))

    const response = await remove(base, `/api/agents/${agent.id}`)

    expect(response.status).toBe(204)
    await vi.waitFor(() => expect(states().at(-1)).toBe("exited"))
    await vi.waitFor(() =>
      expect(app.events.map(({ data }) => data)).toContainEqual({
        type: "agent_deleted",
        agentId: agent.id,
      })
    )
    const events = app.events.map(({ data }) => data)
    expect(events).toContainEqual({
      type: "conversation_deleted",
      conversationId: dm.id,
    })
    expect(events).toContainEqual({
      type: "conversation_deleted",
      conversationId: group.id,
    })
    expect(events).toContainEqual({
      type: "conversation",
      conversation: expect.objectContaining({
        id: channel.id,
        members: ["user:me", `agent:${runner.id}`],
      }),
    })
    const listed = (await (await fetch(`${base}/api/agents`)).json()) as {
      agents: { name: string }[]
    }
    expect(listed.agents.map(({ name }) => name)).toEqual(["test-runner"])
    const again = await remove(base, `/api/agents/${agent.id}`)
    expect(again.status).toBe(404)
  })

  test("a deleted agent cannot be read, changed, or put in a conversation", async () => {
    const { base, agent } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const group = await createConversation(base, {
      kind: "group",
      agentIds: [runner.id],
    })
    await remove(base, `/api/agents/${agent.id}`)

    const read = await fetch(`${base}/api/agents/${agent.id}`)
    const change = await fetch(`${base}/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Back again." }),
    })
    const dm = await postJson(base, "/api/conversations", {
      kind: "dm",
      agentId: agent.id,
    })
    const invite = await postJson(
      base,
      `/api/conversations/${group.id}/members`,
      { agentIds: [agent.id] }
    )

    expect([read.status, change.status, dm.status]).toEqual([404, 404, 400])
    expect(await invite.json()).toMatchObject({
      conversation: { members: ["user:me", `agent:${runner.id}`] },
    })
  })

  test("a conversation names the authors of its messages that are no longer members, and marks a deleted agent", async () => {
    const { base, store, agent } = await startServer()
    const runner = await createAgent(base, "test-runner")
    const channel = await createConversation(base, {
      kind: "channel",
      name: "release-train",
      agentIds: [agent.id, runner.id],
    })
    store.addMessage(channel.id, `agent:${agent.id}`, "PR #212 looks good.")
    store.addMessage(channel.id, `agent:${runner.id}`, "44 tests pass.")
    await remove(base, `/api/agents/${agent.id}`)

    const response = await fetch(`${base}/api/conversations/${channel.id}`)
    const body = (await response.json()) as {
      agents: { name: string }[]
      authors: { id: string; name: string; deletedAt: string | null }[]
    }

    expect(body.agents.map(({ name }) => name)).toEqual(["test-runner"])
    expect(body.authors).toEqual([
      expect.objectContaining({
        id: agent.id,
        name: "reviewer-bot",
        deletedAt: expect.any(String),
      }),
    ])
  })
})
