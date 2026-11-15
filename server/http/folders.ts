import { readdir, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"

export type FolderList = {
  path: string
  parent: string | null
  folders: { name: string; path: string }[]
}

export type FolderAnswer =
  | { status: 200; body: FolderList }
  | { status: 400 | 404; body: { error: string } }

export async function listFolders(asked: string | null): Promise<FolderAnswer> {
  if (asked && !isAbsolute(asked)) {
    return refuse(400, "Give an absolute path.")
  }
  const path = asked ? resolve(asked) : homedir()
  let entries
  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") return refuse(404, "The folder does not exist.")
    if (code === "ENOTDIR") return refuse(400, "The path is not a folder.")
    return refuse(400, "The server cannot read this folder.")
  }
  const folders = []
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const child = join(path, entry.name)
    if (
      entry.isDirectory() ||
      (entry.isSymbolicLink() && (await isFolder(child)))
    ) {
      folders.push({ name: entry.name, path: child })
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name))
  return {
    status: 200,
    body: { path, parent: path === "/" ? null : dirname(path), folders },
  }
}

export async function folderError(path: string): Promise<string | null> {
  const answer = await listFolders(path)
  return answer.status === 200 ? null : answer.body.error
}

async function isFolder(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

function refuse(status: 400 | 404, error: string): FolderAnswer {
  return { status, body: { error } }
}
