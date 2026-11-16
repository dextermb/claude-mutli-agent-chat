import { FoldVerticalIcon } from "lucide-react"

import type { CompactionItem, TimelineEntry } from "@/lib/agent-api"
import { clockTime } from "@/lib/time"

export function CompactionDivider({
  item,
  turn,
  createdAt,
  agentName,
}: {
  item: CompactionItem
  turn: TimelineEntry | undefined
  createdAt: string
  agentName: string
}) {
  const count = (value: number | null) => (value ?? 0).toLocaleString("en-GB")
  const what =
    item.status === "running"
      ? `${agentName} compacts its memory…`
      : `${agentName} compacted its memory: ${count(item.preTokens)} → ${count(item.postTokens)} tokens`
  const cost =
    turn?.item.kind === "turn" ? ` · $${turn.item.costUsd.toFixed(3)}` : ""
  const label = `${what}${cost} · ${clockTime(createdAt)}`
  return (
    <div
      role="separator"
      aria-label={label}
      aria-busy={item.status === "running"}
      className="mx-5 my-1 flex items-center gap-3 text-xs text-foreground-faint"
    >
      <span className="flex-1 border-t border-dashed border-border" />
      <span className="inline-flex items-center gap-1.5">
        <FoldVerticalIcon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      <span className="flex-1 border-t border-dashed border-border" />
    </div>
  )
}
