import { statSync } from "node:fs"
import { stat } from "node:fs/promises"
import { basename, resolve, sep } from "node:path"
import type { SharedFile } from "../timeline/reduce.ts"

export type FileCheck =
  { ok: true; files: SharedFile[] } | { ok: false; error: string }

export async function checkFiles(
  value: unknown,
  places: { agentFolders: string[]; uploads: string }
): Promise<FileCheck> {
  if (value === undefined) return { ok: true, files: [] }
  if (!Array.isArray(value))
    return { ok: false, error: "Give a list of files." }
  const files: SharedFile[] = []
  for (const raw of value as Record<string, unknown>[]) {
    const path = typeof raw?.path === "string" ? resolve(raw.path) : ""
    const kind = raw?.kind
    const name = typeof raw?.name === "string" ? raw.name : basename(path)
    const inside =
      kind === "copied"
        ? within(places.uploads, path)
        : kind === "linked" &&
          places.agentFolders.some((folder) => within(folder, path))
    const size = inside ? await fileSize(path) : null
    if (size === null) {
      return {
        ok: false,
        error: `${name || "A file"} is not a file that this conversation can share.`,
      }
    }
    files.push({ name, path, kind: kind as SharedFile["kind"], size })
  }
  return { ok: true, files }
}

export function sharedFileLines(files: SharedFile[] | undefined): string {
  return (files ?? []).map((file) => `\n[Shared file: ${file.path}]`).join("")
}

function within(folder: string, path: string): boolean {
  const root = resolve(folder)
  return path.startsWith(root.endsWith(sep) ? root : root + sep)
}

async function fileSize(path: string): Promise<number | null> {
  try {
    const info = await stat(path)
    return info.isFile() ? info.size : null
  } catch {
    return null
  }
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}
