import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

const SKIPPED = new Set(["node_modules", "dist", "build", "target"])
const MAX_ENTRIES = 50_000
const MAX_MS = 2_000

export type Fingerprint = { name: string; size: number; sha256: string }

export async function findFile(
  folders: string[],
  wanted: Fingerprint
): Promise<string | null> {
  const matches: { path: string; changedAt: number }[] = []
  for (const folder of new Set(folders)) {
    for (const path of await candidates(folder, wanted)) {
      if ((await sha256Of(path)) !== wanted.sha256) continue
      matches.push({ path, changedAt: (await stat(path)).mtimeMs })
    }
  }
  matches.sort((a, b) => b.changedAt - a.changedAt)
  return matches[0]?.path ?? null
}

async function candidates(
  root: string,
  wanted: Fingerprint
): Promise<string[]> {
  const found: string[] = []
  const queue = [root]
  const started = Date.now()
  let entries = 0
  while (queue.length > 0) {
    if (entries > MAX_ENTRIES || Date.now() - started > MAX_MS) break
    const folder = queue.shift() as string
    let items
    try {
      items = await readdir(folder, { withFileTypes: true })
    } catch {
      continue
    }
    for (const item of items) {
      entries += 1
      if (item.name.startsWith(".") || SKIPPED.has(item.name)) continue
      const path = join(folder, item.name)
      if (item.isDirectory()) queue.push(path)
      else if (item.isFile() && item.name === wanted.name) {
        const info = await stat(path)
        if (info.size === wanted.size) found.push(path)
      }
    }
  }
  return found
}

function sha256Of(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256")
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject)
  })
}
