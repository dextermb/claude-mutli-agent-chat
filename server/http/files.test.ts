import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import {
  postJson,
  promptsTo,
  runCleanups,
  sendMessage,
  startServer,
  testRunner,
} from "../test/http.ts"

afterEach(runCleanups)

async function upload(
  base: string,
  conversationId: string,
  name: string,
  body: string | Uint8Array
) {
  return fetch(
    `${base}/api/conversations/${conversationId}/uploads?name=${encodeURIComponent(name)}`,
    { method: "PUT", body }
  )
}

describe("uploads", () => {
  test("an upload is stored in the folder of its conversation, and a second file with the same name gets a number", async () => {
    const { base, conversation, uploadsFolder } = await startServer()

    const first = await upload(base, conversation.id, "ci-log.txt", "line 1\n")
    const second = await upload(base, conversation.id, "ci-log.txt", "line 2\n")

    expect(first.status).toBe(201)
    const folder = join(uploadsFolder, conversation.id)
    expect(await first.json()).toEqual({
      name: "ci-log.txt",
      path: join(folder, "ci-log.txt"),
      size: 7,
    })
    expect(await second.json()).toEqual({
      name: "ci-log (2).txt",
      path: join(folder, "ci-log (2).txt"),
      size: 7,
    })
    expect(readFileSync(join(folder, "ci-log (2).txt"), "utf8")).toBe(
      "line 2\n"
    )
  })

  test("an upload keeps only the base name, and refuses an empty name, a file over the limit and an unknown conversation", async () => {
    const { base, conversation, uploadsFolder } = await startServer(
      "resume-1",
      ":memory:",
      undefined,
      () => ({}),
      { uploadLimit: 10 }
    )

    const escaped = await upload(base, conversation.id, "../../evil.txt", "x")
    const empty = await upload(base, conversation.id, "", "x")
    const large = await upload(base, conversation.id, "big.txt", "x".repeat(11))
    const unknown = await upload(base, "nowhere", "a.txt", "x")

    expect(await escaped.json()).toEqual({
      name: "evil.txt",
      path: join(uploadsFolder, conversation.id, "evil.txt"),
      size: 1,
    })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: "Give the name of the file." })
    expect(large.status).toBe(413)
    expect(await large.json()).toEqual({ error: "The limit is 0 MB." })
    expect(existsSync(join(uploadsFolder, conversation.id, "big.txt"))).toBe(
      false
    )
    expect(unknown.status).toBe(404)
  })

  test("each process can read the uploads of its conversation, and the folder exists before it starts", async () => {
    const { base, conversation, uploadsFolder, started } = await startServer()

    await sendMessage(base, conversation.id, "Run the tests.")
    await vi.waitFor(() => expect(started).toHaveLength(1))

    const args = started[0]
    const folder = join(uploadsFolder, conversation.id)
    expect(args[args.indexOf("--add-dir") + 1]).toBe(folder)
    expect(existsSync(folder)).toBe(true)
  })

  test("a message shares a copied file: the message keeps it, and the prompt of the agent names its path", async () => {
    const { base, conversation, sentTo } = await startServer()
    const copied = (await (
      await upload(base, conversation.id, "ci-log.txt", "line 1\n")
    ).json()) as { name: string; path: string; size: number }

    const response = await postJson(
      base,
      `/api/conversations/${conversation.id}/messages`,
      {
        text: "Here is the CI log.",
        files: [{ ...copied, kind: "copied" }],
      }
    )

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({
      entry: {
        item: {
          kind: "message",
          text: "Here is the CI log.",
          files: [{ ...copied, kind: "copied" }],
        },
      },
    })
    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot")).toEqual([
        `Here is the CI log.\n[Shared file: ${copied.path}]`,
      ])
    )
  })

  test("a linked file must be in the folder of an agent member, and a copied file in the uploads", async () => {
    const { base, conversation } = await startServer()
    const share = (files: unknown[]) =>
      postJson(base, `/api/conversations/${conversation.id}/messages`, {
        text: "",
        files,
      })
    const linkedPath = join(process.cwd(), "package.json")

    const linked = await share([{ path: linkedPath, kind: "linked" }])
    const outside = await share([{ path: "/etc/hosts", kind: "linked" }])
    const fakeCopy = await share([{ path: linkedPath, kind: "copied" }])

    expect(linked.status).toBe(202)
    expect(await linked.json()).toMatchObject({
      entry: {
        item: {
          text: "",
          files: [{ name: "package.json", path: linkedPath, kind: "linked" }],
        },
      },
    })
    expect(outside.status).toBe(400)
    expect(await outside.json()).toEqual({
      error: "hosts is not a file that this conversation can share.",
    })
    expect(fakeCopy.status).toBe(400)
  })

  test("the shared files of a conversation are a set of paths, and the user can remove one", async () => {
    const { base, conversation } = await startServer()
    const copied = (await (
      await upload(base, conversation.id, "ci-log.txt", "line 1\n")
    ).json()) as { name: string; path: string; size: number }
    const share = () =>
      postJson(base, `/api/conversations/${conversation.id}/messages`, {
        text: "The log.",
        files: [{ ...copied, kind: "copied" }],
      })
    await share()
    await share()

    const listed = (await (
      await fetch(`${base}/api/conversations/${conversation.id}/files`)
    ).json()) as { files: { id: string }[] }

    expect(listed.files).toEqual([
      {
        id: expect.any(String),
        name: "ci-log.txt",
        path: copied.path,
        kind: "copied",
        size: 7,
        sharedBy: "User",
        sharedAt: expect.any(String),
        removedAt: null,
        exists: true,
      },
    ])

    const removed = await fetch(
      `${base}/api/conversations/${conversation.id}/files/${listed.files[0].id}`,
      { method: "DELETE" }
    )

    expect(removed.status).toBe(200)
    expect(await removed.json()).toMatchObject({
      file: { removedAt: expect.any(String), exists: false },
    })
    expect(existsSync(copied.path)).toBe(false)
  })

  test("after a removal, the next prompt of each agent starts with the removed path", async () => {
    const { base, conversation, sentTo } = await startServer()
    const linkedPath = join(process.cwd(), "package.json")
    await postJson(base, `/api/conversations/${conversation.id}/messages`, {
      text: "See this.",
      files: [{ path: linkedPath, kind: "linked" }],
    })
    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot")).toHaveLength(1)
    )
    const { files } = (await (
      await fetch(`${base}/api/conversations/${conversation.id}/files`)
    ).json()) as { files: { id: string }[] }

    await fetch(
      `${base}/api/conversations/${conversation.id}/files/${files[0].id}`,
      { method: "DELETE" }
    )
    await sendMessage(base, conversation.id, "Go on.")

    await vi.waitFor(() =>
      expect(promptsTo(sentTo, "reviewer-bot").at(-1)).toBe(
        `[Removed file: ${linkedPath}]\nGo on.`
      )
    )
    expect(existsSync(linkedPath)).toBe(true)
  })

  test("find links a dropped file to the file with the same name, size and content in the folder of an agent", async () => {
    const { base } = await startServer()
    const folder = mkdtempSync(join(tmpdir(), "find-test-"))
    mkdirSync(join(folder, "src"))
    mkdirSync(join(folder, "node_modules"))
    writeFileSync(join(folder, "src", "auth.test.ts"), "the real test\n")
    writeFileSync(join(folder, "auth.test.ts"), "another text!\n")
    writeFileSync(join(folder, "node_modules", "auth.test.ts"), "the real test\n")
    const agent = (await (
      await postJson(base, "/api/agents", { ...testRunner, cwd: folder })
    ).json()) as { agent: { id: string } }
    const dm = (await (
      await postJson(base, "/api/conversations", {
        kind: "dm",
        agentId: agent.agent.id,
      })
    ).json()) as { conversation: { id: string } }
    const find = (content: string) =>
      postJson(base, `/api/conversations/${dm.conversation.id}/files/find`, {
        name: "auth.test.ts",
        size: Buffer.byteLength(content),
        sha256: createHash("sha256").update(content).digest("hex"),
      })

    const found = await find("the real test\n")
    const none = await find("not on the disk\n")

    expect(await found.json()).toEqual({
      match: { path: join(folder, "src", "auth.test.ts") },
    })
    expect(await none.json()).toEqual({ match: null })
    rmSync(folder, { recursive: true, force: true })
  })
})
