import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { basename, join } from "node:path"
import { walk } from "./paths.ts"

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
  for (const file of await walk(root)) {
    if (basename(file) !== wanted.name) continue
    const path = join(root, file)
    if ((await stat(path)).size === wanted.size) found.push(path)
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
