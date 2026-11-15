import type { TimelineEntry } from "@/lib/agent-api"
import { filesOf } from "@/lib/files"
import { clockTime } from "@/lib/time"

export function FilesTab({
  entries,
  cwd,
  agentName,
  onOpen,
}: {
  entries: TimelineEntry[]
  cwd: string
  agentName: string
  onOpen: (entryId: string) => void
}) {
  const rows = filesOf(entries, cwd)
  if (rows.length === 0) {
    return (
      <p className="m-0 p-5 text-muted-foreground">
        {`${agentName} has not opened a file in this conversation.`}
      </p>
    )
  }
  return (
    <table aria-label="Files" className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="px-5 py-2 font-medium">File</th>
          <th className="px-2 py-2 font-medium">Last</th>
          <th className="px-2 py-2 font-medium">Changes</th>
          <th className="px-5 py-2 text-right font-medium">Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.path} className="border-b">
            <td className="px-5 py-2 font-mono">
              <button
                type="button"
                className="text-link hover:underline"
                onClick={() => onOpen(row.entryId)}
              >
                {row.path}
              </button>
            </td>
            <td className="px-2 py-2">{row.last}</td>
            <td className="px-2 py-2 font-mono">
              {[
                row.added > 0 && `+${row.added}`,
                row.removed > 0 && `−${row.removed}`,
              ]
                .filter(Boolean)
                .join(" ")}
            </td>
            <td className="px-5 py-2 text-right text-foreground-faint">
              <time dateTime={row.createdAt}>{clockTime(row.createdAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
