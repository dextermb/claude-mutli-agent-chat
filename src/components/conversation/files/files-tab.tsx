import { FileIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { TimelineEntry } from "@/lib/agent-api"
import { filesOf } from "@/lib/files"
import { clockTime } from "@/lib/time"

const CELL = "px-3 py-2.5"

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
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 className="m-0 text-sm font-semibold text-foreground-strong">
          {rows.length === 1 ? "1 file" : `${rows.length} files`}
        </h2>
        <p className="m-0 min-w-60 flex-1 text-[13px] text-muted-foreground">
          {`Each file that ${agentName} read or changed in this DM. Select a path to see its last tool call.`}
        </p>
      </div>
      <div className="overflow-x-auto rounded-[14px] border">
        <table
          aria-label="Files"
          className="w-full min-w-[560px] border-collapse text-[13px]"
        >
          <thead>
            <tr className="bg-rail text-left text-muted-foreground">
              <th scope="col" className={`${CELL} py-2 font-medium`}>
                File
              </th>
              <th scope="col" className={`${CELL} py-2 font-medium`}>
                Last action
              </th>
              <th scope="col" className={`${CELL} py-2 text-right font-medium`}>
                Lines
              </th>
              <th scope="col" className={`${CELL} py-2 text-right font-medium`}>
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.path} className="border-t">
                <td className={`${CELL} font-mono`}>
                  <span className="inline-flex items-center gap-2">
                    <FileIcon
                      aria-hidden="true"
                      className="size-4 flex-none text-foreground-faint"
                    />
                    <button
                      type="button"
                      className="text-link hover:underline"
                      onClick={() => onOpen(row.entryId)}
                    >
                      {row.path}
                    </button>
                  </span>
                </td>
                <td className={CELL}>
                  <Badge
                    variant={row.last === "Read" ? "secondary" : "outline"}
                  >
                    {row.last}
                  </Badge>
                </td>
                <td
                  className={`${CELL} text-right font-mono whitespace-nowrap`}
                >
                  {row.added === 0 && row.removed === 0 ? (
                    <span className="text-foreground-faint">none</span>
                  ) : (
                    <>
                      {row.added > 0 && (
                        <span className="text-diff-add">{`+${row.added}`}</span>
                      )}
                      {row.added > 0 && row.removed > 0 && " "}
                      {row.removed > 0 && (
                        <span className="text-diff-remove">{`−${row.removed}`}</span>
                      )}
                    </>
                  )}
                </td>
                <td
                  className={`${CELL} text-right text-foreground-faint tabular-nums`}
                >
                  <time dateTime={row.createdAt}>
                    {clockTime(row.createdAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-xs text-foreground-faint">
        A tool call that failed does not count.
      </p>
    </div>
  )
}
