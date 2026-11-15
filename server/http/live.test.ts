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
})
