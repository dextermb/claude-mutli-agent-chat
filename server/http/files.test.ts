import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import { runCleanups, sendMessage, startServer } from "../test/http.ts"

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
})
