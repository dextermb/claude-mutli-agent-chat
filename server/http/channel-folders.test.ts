import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
  cleanups,
  factsTo,
  postJson,
  runCleanups,
  sendMessage,
  startServer,
  testRunner,
  timeline,
} from "../test/http.ts"

afterEach(runCleanups)

function projectFolder() {
  const folder = mkdtempSync(join(tmpdir(), "project-"))
  cleanups.unshift(async () => rmSync(folder, { recursive: true }))
  return folder
}

async function makeChannel(base: string, body: Record<string, unknown>) {
  const response = await postJson(base, "/api/conversations", {
    kind: "channel",
    name: "billing-api",
    ...body,
  })
  return {
    response,
    body: (await response.json()) as {
      conversation: { id: string; cwd: string | null }
    },
  }
}

describe("the folder of an agent session", () => {
  test("an agent in a channel with a folder works in the folder of the channel", async () => {
    const { base, store, startedIn } = await startServer()
    const agent = store.createAgent(testRunner)
    const folder = projectFolder()
    const channel = await makeChannel(base, {
      cwd: folder,
      agentIds: [agent.id],
    })

    await sendMessage(
      base,
      channel.body.conversation.id,
      "@test-runner run the tests."
    )

    await vi.waitFor(() => expect(startedIn).toEqual([folder]))
  })

  test("the facts of an agent in a channel with a folder say that it works in the folder of the channel", async () => {
    const { base, store, sentTo } = await startServer()
    const agent = store.createAgent(testRunner)
    const folder = projectFolder()
    const channel = await makeChannel(base, {
      cwd: folder,
      agentIds: [agent.id],
    })

    await sendMessage(
      base,
      channel.body.conversation.id,
      "@test-runner run the tests."
    )

    await vi.waitFor(() =>
      expect(factsTo(sentTo, "test-runner")).toHaveLength(1)
    )
    expect(factsTo(sentTo, "test-runner")[0]).toContain(
      `- You work in ${folder}, the folder of this channel.`
    )
  })

  test("a generic agent in a DM works in a scratch folder of that DM, which the server makes", async () => {
    const { base, store, startedIn, scratchRoot } = await startServer()
    const agent = store.createAgent({ ...testRunner, cwd: null })
    const dm = await postJson(base, "/api/conversations", {
      kind: "dm",
      agentId: agent.id,
    })
    const { conversation } = (await dm.json()) as {
      conversation: { id: string }
    }

    await sendMessage(base, conversation.id, "Hello.")

    const scratch = join(scratchRoot, conversation.id)
    await vi.waitFor(() => expect(startedIn).toEqual([scratch]))
    expect(existsSync(scratch)).toBe(true)
  })

  test("a channel with a folder that does not exist is refused, and no channel is made", async () => {
    const { base } = await startServer()
    const missing = join(projectFolder(), "missing")

    const channel = await makeChannel(base, { cwd: missing })

    expect(channel.response.status).toBe(400)
    expect(channel.body).toEqual({
      error: "The folder does not exist.",
      fields: { cwd: "The folder does not exist." },
    })
    const listed = (await (
      await fetch(`${base}/api/conversations`)
    ).json()) as {
      conversations: { name: string }[]
    }
    expect(listed.conversations.map((item) => item.name)).not.toContain(
      "billing-api"
    )
  })

  test("after a change of the channel folder, the card shows the change, and the next process resumes in the new folder", async () => {
    const { base, store, started, startedIn } = await startServer()
    const agent = store.createAgent(testRunner)
    const before = projectFolder()
    const after = projectFolder()
    const channel = await makeChannel(base, {
      cwd: before,
      agentIds: [agent.id],
    })
    const id = channel.body.conversation.id
    await sendMessage(base, id, "@test-runner remember kiwi.")
    await vi.waitFor(async () => {
      const { items } = await timeline(base, id)
      expect(items.at(-1)?.item.kind).toBe("turn")
    })

    const patched = await fetch(`${base}/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: after }),
    })
    const card = await fetch(
      `${base}/api/conversations/${id}/agents/${agent.id}/session`
    )
    await postJson(base, `/api/agents/${agent.id}/restart`, {})

    expect(await patched.json()).toMatchObject({ conversation: { cwd: after } })
    expect(await card.json()).toMatchObject({
      session: { directory: before, configChanged: true },
    })
    await vi.waitFor(() => expect(startedIn).toEqual([before, after]))
    expect(started.at(-1)).toContain("--resume")
  })

  test("a conversation gives each agent the folder that its session works in", async () => {
    const { base, store } = await startServer()
    const agent = store.createAgent(testRunner)
    const folder = projectFolder()
    const channel = await makeChannel(base, {
      cwd: folder,
      agentIds: [agent.id],
    })

    const response = await fetch(
      `${base}/api/conversations/${channel.body.conversation.id}`
    )

    expect(await response.json()).toMatchObject({
      agents: [{ name: "test-runner", sessionCwd: folder }],
    })
  })
})
