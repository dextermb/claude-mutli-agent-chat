import type { TimelineEntry, ToolCallItem } from "@/lib/agent-api"

export type FileRow = {
  path: string
  last: "Read" | "Edited" | "Created"
  added: number
  removed: number
  createdAt: string
  entryId: string
}

const FILE_TOOLS = ["Read", "Edit", "MultiEdit", "Write", "NotebookEdit"]

export function filesOf(entries: TimelineEntry[], cwd: string): FileRow[] {
  const rows = new Map<string, FileRow>()
  for (const entry of entries) {
    const { item } = entry
    if (item.kind !== "tool_call" || item.status !== "done") continue
    if (!FILE_TOOLS.includes(item.name)) continue
    const path = filePath(item, cwd)
    if (!path) continue
    const earlier = rows.get(path)
    const diff = item.result?.kind === "diff" ? item.result : null
    rows.delete(path)
    rows.set(path, {
      path,
      last: lastAction(item),
      added: (earlier?.added ?? 0) + (diff?.added ?? 0),
      removed: (earlier?.removed ?? 0) + (diff?.removed ?? 0),
      createdAt: entry.createdAt,
      entryId: entry.id,
    })
  }
  return [...rows.values()].reverse()
}

function filePath(item: ToolCallItem, cwd: string): string | null {
  const value = item.input.file_path ?? item.input.notebook_path
  if (typeof value !== "string") return null
  const prefix = cwd.endsWith("/") ? cwd : `${cwd}/`
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

function lastAction(item: ToolCallItem): FileRow["last"] {
  if (item.name === "Read") return "Read"
  if (item.name === "Write" && item.result?.kind === "diff") return "Created"
  return "Edited"
}
