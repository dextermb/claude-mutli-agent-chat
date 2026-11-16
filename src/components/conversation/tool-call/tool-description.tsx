import { TraceDescription } from "@/components/ui/trace"
import type { ToolCallItem } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function ToolDescription({
  call,
  subagentCount,
}: {
  call: ToolCallItem
  subagentCount: number
}) {
  const { result } = call
  const parts = [
    call.status === "stopped" && "Stopped",
    result?.kind === "lines" && `${result.count} lines`,
    result?.kind === "diff" &&
      [
        result.added > 0 && `+${result.added}`,
        result.removed > 0 && `−${result.removed}`,
      ]
        .filter(Boolean)
        .join(" "),
    subagentCount === 1 && "1 tool call",
    subagentCount > 1 && `${subagentCount} tool calls`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <TraceDescription
      className={cn(
        "text-foreground-faint",
        result?.kind === "diff" && "font-mono"
      )}
    >
      {parts.join(" · ")}
    </TraceDescription>
  )
}
