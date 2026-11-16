import { RotateCcwIcon } from "lucide-react"

import { clockTime } from "@/lib/time"

export function SessionDivider({
  createdAt,
  agentName,
}: {
  createdAt: string
  agentName: string | undefined
}) {
  const label = `New session${agentName ? ` for ${agentName}` : ""} · ${clockTime(createdAt)}`
  return (
    <div
      role="separator"
      aria-label={label}
      className="mx-5 my-1 flex items-center gap-3 text-xs text-link"
    >
      <span className="flex-1 border-t border-dashed border-link" />
      <span className="inline-flex items-center gap-1.5">
        <RotateCcwIcon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      <span className="flex-1 border-t border-dashed border-link" />
    </div>
  )
}
