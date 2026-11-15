import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import { runCleanups, startServer } from "../test/http.ts"

const folders: string[] = []

afterEach(async () => {
  await runCleanups()
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true })
  }
})

function projectsFolder() {
  const root = mkdtempSync(join(tmpdir(), "folders-test-"))
  folders.push(root)
  mkdirSync(join(root, "web-app"))
  mkdirSync(join(root, "api"))
  mkdirSync(join(root, ".cache"))
  writeFileSync(join(root, "notes.txt"), "hello\n")
  return root
}

async function list(base: string, path?: string) {
  const query = path === undefined ? "" : `?path=${encodeURIComponent(path)}`
  return fetch(`${base}/api/folders${query}`)
}

describe("the folder list", () => {
  test("a folder lists its subfolders by name, with no files and no hidden folders", async () => {
    const { base } = await startServer()
    const root = projectsFolder()
    symlinkSync(join(root, "api"), join(root, "linked-api"))

    const response = await list(base, root)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      path: root,
      parent: join(root, ".."),
      folders: [
        { name: "api", path: join(root, "api") },
        { name: "linked-api", path: join(root, "linked-api") },
        { name: "web-app", path: join(root, "web-app") },
      ],
    })
  })

  test("with no path, the list starts at the home folder, and the root has no parent", async () => {
    const { base } = await startServer()

    const home = (await (await list(base)).json()) as { path: string }
    const top = (await (await list(base, "/")).json()) as {
      parent: string | null
    }

    expect(home.path).toBe(homedir())
    expect(top.parent).toBeNull()
  })

  test("a path that is missing, a file, or not absolute is refused", async () => {
    const { base } = await startServer()
    const root = projectsFolder()

    const missing = await list(base, join(root, "gone"))
    const file = await list(base, join(root, "notes.txt"))
    const relative = await list(base, "web-app")

    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({
      error: "The folder does not exist.",
    })
    expect(file.status).toBe(400)
    expect(await file.json()).toEqual({ error: "The path is not a folder." })
    expect(relative.status).toBe(400)
    expect(await relative.json()).toEqual({ error: "Give an absolute path." })
  })
})
