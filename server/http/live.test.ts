import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { AgentSession } from "../session/session.ts"
import { openStore } from "../store/store.ts"
import { createServer } from "./server.ts"

describe.skipIf(process.env.CLAUDE_LIVE !== "1")("live check", () => {
  test("the real claude answers a prompt in a DM, and the turn ends", async () => {
    const folder = mkdtempSync(join(tmpdir(), "live-check-"))
    const store = openStore(":memory:")
    const server = createServer({
      store,
      uploadsFolder: join(folder, ".uploads"),
      startSession: ({ args, cwd, onEvent }) => {
        const session = new AgentSession({
          command: "claude",
          args,
          cwd,
          env: process.env,
          onEvent,
        })
        session.start()
        return session
      },
    })
    const address = await server.listen(0)
    const base = `http://${address.host}:${address.port}`
    try {
      const agent = store.createAgent({
        name: "live-check",
        colour: "aqua",
        model: "claude-haiku-5-5",
        permissionMode: "default",
        cwd: folder,
        autostart: false,
        allowedTools: [],
        disallowedTools: [],
        systemPrompt: null,
        description: null,
        maxTurns: null,
      })
      const conversation = store.createConversation({
        kind: "dm",
        name: agent.name,
        topic: null,
        private: true,
        replyMode: "every",
        members: ["user:me", `agent:${agent.id}`],
      })

      await fetch(`${base}/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Reply with the single word ok. Do not use any tools.",
        }),
      })

      await vi.waitFor(
        async () => {
          const response = await fetch(
            `${base}/api/conversations/${conversation.id}/timeline`
          )
          const { items } = (await response.json()) as {
            items: { item: { kind: string; status: string; text?: string } }[]
          }
          const kinds = items.map(({ item }) => item.kind)
          expect(kinds).toEqual(["message", "message", "turn"])
          expect(items[1].item.text?.toLowerCase()).toContain("ok")
          expect(items[2].item.status).toBe("done")
        },
        { timeout: 90_000, interval: 500 }
      )
    } finally {
      await server.close()
      store.close()
      rmSync(folder, { recursive: true })
    }
  }, 120_000)

  test("a new session uses the id that the server chose, and the next process resumes it", async () => {
    const folder = mkdtempSync(join(tmpdir(), "live-check-"))
    const store = openStore(":memory:")
    const started: string[][] = []
    const startServer = async () => {
      const server = createServer({
        store,
        uploadsFolder: join(folder, ".uploads"),
        startSession: ({ args, cwd, onEvent }) => {
          started.push(args)
          const session = new AgentSession({
            command: "claude",
            args,
            cwd,
            env: process.env,
            onEvent,
          })
          session.start()
          return session
        },
      })
      const address = await server.listen(0)
      return { server, base: `http://${address.host}:${address.port}` }
    }
    const agent = store.createAgent({
      name: "live-check",
      colour: "aqua",
      model: "claude-haiku-5-5",
      permissionMode: "default",
      cwd: folder,
      autostart: false,
      allowedTools: [],
      disallowedTools: [],
      systemPrompt: null,
      description: null,
      maxTurns: null,
    })
    const conversation = store.createConversation({
      kind: "dm",
      name: agent.name,
      topic: null,
      private: true,
      replyMode: "every",
      members: ["user:me", `agent:${agent.id}`],
    })
    const post = (base: string, route: string, body: unknown) =>
      fetch(`${base}${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    const untilTurns = (count: number) =>
      vi.waitFor(
        () =>
          expect(
            store
              .listTimeline(conversation.id)
              .filter(({ item }) => item.kind === "turn")
          ).toHaveLength(count),
        { timeout: 90_000, interval: 500 }
      )
    let first = await startServer()
    try {
      const response = await post(
        first.base,
        `/api/conversations/${conversation.id}/agents/${agent.id}/sessions`,
        {}
      )
      const { session } = (await response.json()) as {
        session: { claudeSessionId: string }
      }
      await post(first.base, `/api/conversations/${conversation.id}/messages`, {
        text: "Remember the word kiwi. Reply with the single word ok. Do not use any tools.",
      })
      await untilTurns(1)
      await first.server.close()

      first = await startServer()
      await post(first.base, `/api/conversations/${conversation.id}/messages`, {
        text: "Which word did I ask you to remember? Reply with that word only.",
      })
      await untilTurns(2)

      expect(started.map((args) => args.slice(-2))).toEqual([
        ["--session-id", session.claudeSessionId],
        ["--resume", session.claudeSessionId],
      ])
      expect(
        store.latestSession(agent.id, conversation.id)?.claudeSessionId
      ).toBe(session.claudeSessionId)
      const replies = store
        .listTimeline(conversation.id)
        .flatMap(({ authorKey, item }) =>
          authorKey !== "user:me" && item.kind === "message" ? [item.text] : []
        )
      expect(replies.at(-1)?.toLowerCase()).toContain("kiwi")
    } finally {
      await first.server.close()
      store.close()
      rmSync(folder, { recursive: true })
    }
  }, 240_000)

  test("an agent in a channel knows the name of the channel from the facts in its prompt", async () => {
    const folder = mkdtempSync(join(tmpdir(), "live-check-"))
    const store = openStore(":memory:")
    const server = createServer({
      store,
      uploadsFolder: join(folder, ".uploads"),
      startSession: ({ args, cwd, onEvent }) => {
        const session = new AgentSession({
          command: "claude",
          args,
          cwd,
          env: process.env,
          onEvent,
        })
        session.start()
        return session
      },
    })
    const address = await server.listen(0)
    const base = `http://${address.host}:${address.port}`
    try {
      const agent = store.createAgent({
        name: "live-check",
        colour: "aqua",
        model: "claude-haiku-5-5",
        permissionMode: "default",
        cwd: folder,
        autostart: false,
        allowedTools: [],
        disallowedTools: [],
        systemPrompt: null,
        description: null,
        maxTurns: null,
      })
      const conversation = store.createConversation({
        kind: "channel",
        name: "orchard-plans",
        topic: null,
        private: false,
        replyMode: "mention",
        members: ["user:me", `agent:${agent.id}`],
      })

      await fetch(`${base}/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "@live-check What is the name of this channel? Reply with the name only. Do not use any tools.",
        }),
      })

      await vi.waitFor(
        async () => {
          const response = await fetch(
            `${base}/api/conversations/${conversation.id}/timeline`
          )
          const { items } = (await response.json()) as {
            items: { item: { kind: string; status: string; text?: string } }[]
          }
          expect(items.map(({ item }) => item.kind)).toEqual([
            "message",
            "message",
            "turn",
          ])
          expect(items[1].item.text).toContain("orchard-plans")
        },
        { timeout: 90_000, interval: 500 }
      )
    } finally {
      await server.close()
      store.close()
      rmSync(folder, { recursive: true })
    }
  }, 120_000)

  test("an agent calls a read tool of the chat server with no card, and has the skills of the chat plugin", async () => {
    const folder = mkdtempSync(join(tmpdir(), "live-check-"))
    const store = openStore(":memory:")
    const server = createServer({
      store,
      uploadsFolder: join(folder, ".uploads"),
      startSession: ({ args, cwd, onEvent }) => {
        const session = new AgentSession({
          command: "claude",
          args,
          cwd,
          env: process.env,
          onEvent,
        })
        session.start()
        return session
      },
    })
    const address = await server.listen(0)
    const base = `http://${address.host}:${address.port}`
    try {
      const agent = store.createAgent({
        name: "live-check",
        colour: "aqua",
        model: "claude-haiku-5-5",
        permissionMode: "default",
        cwd: folder,
        autostart: false,
        allowedTools: [],
        disallowedTools: [],
        systemPrompt: null,
        description: null,
        maxTurns: null,
      })
      const conversation = store.createConversation({
        kind: "dm",
        name: agent.name,
        topic: null,
        private: true,
        replyMode: "every",
        members: ["user:me", `agent:${agent.id}`],
      })

      await fetch(`${base}/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Call the get_conversation tool of the chat server one time. Then reply with the value of its replyMode field only.",
        }),
      })

      await vi.waitFor(
        async () => {
          const response = await fetch(
            `${base}/api/conversations/${conversation.id}/timeline`
          )
          const { items } = (await response.json()) as {
            items: { item: Record<string, unknown> }[]
          }
          const call = items.find(
            ({ item }) => item.name === "mcp__chat__get_conversation"
          )
          expect(call?.item).toMatchObject({
            name: "mcp__chat__get_conversation",
            status: "done",
          })
          expect(items.some(({ item }) => item.kind === "permission")).toBe(
            false
          )
          expect(items.at(-1)?.item.kind).toBe("turn")
          expect(String(items.at(-2)?.item.text)).toContain("every")
        },
        { timeout: 90_000, interval: 500 }
      )
      const session = store.latestSession(agent.id, conversation.id)
      const init = store
        .listLines(String(session?.id))
        .map((line) => JSON.parse(line.text) as Record<string, unknown>)
        .find((line) => line.subtype === "init")
      expect(init?.mcp_servers).toContainEqual(
        expect.objectContaining({ name: "chat" })
      )
      expect(JSON.stringify(init?.skills)).toContain("chat:ask-an-agent")
      expect(JSON.stringify(init?.skills)).toContain("chat:hand-off")
      expect(JSON.stringify(init?.skills)).toContain("chat:catch-up")
    } finally {
      await server.close()
      store.close()
      rmSync(folder, { recursive: true })
    }
  }, 120_000)
})
