import { execFile } from "node:child_process"
import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"

const SKIPPED = new Set(["node_modules", "dist", "build", "target"])
const MAX_ENTRIES = 50_000
const MAX_MS = 2_000
const CACHE_MS = 30_000
const LIMIT = 20

const cache = new Map<string, { at: number; files: Promise<string[]> }>()

export type PathMatch = { path: string; relative: string; agentId: string }

export async function searchPaths(
  folders: { agentId: string; cwd: string }[],
  query: string
): Promise<PathMatch[]> {
  const wanted = query.toLowerCase()
  const seen = new Set<string>()
  const matches: PathMatch[] = []
  for (const { agentId, cwd } of folders) {
    if (seen.has(cwd)) continue
    seen.add(cwd)
    for (const file of await filesOf(cwd)) {
      if (!file.toLowerCase().includes(wanted)) continue
      matches.push({ path: join(cwd, file), relative: file, agentId })
    }
  }
  return matches
    .sort((a, b) => rank(a, wanted) - rank(b, wanted))
    .slice(0, LIMIT)
}

function rank(match: PathMatch, wanted: string): number {
  const name = match.relative.split("/").at(-1)?.toLowerCase() ?? ""
  return match.relative.length * 2 + (name.startsWith(wanted) ? 0 : 1)
}

export function filesOf(cwd: string): Promise<string[]> {
  const cached = cache.get(cwd)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.files
  const files = gitFiles(cwd).then((listed) => listed ?? walk(cwd))
  cache.set(cwd, { at: Date.now(), files })
  return files
}

function gitFiles(cwd: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd, timeout: MAX_MS, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout) =>
        resolve(error ? null : stdout.split("\n").filter(Boolean))
    )
  })
}

export async function walk(root: string): Promise<string[]> {
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
      else if (item.isFile()) found.push(relative(root, path))
    }
  }
  return found
}
