import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function FactRow({
  term,
  value,
  mono = false,
  action,
}: {
  term: string
  value: string
  mono?: boolean
  action?: ReactNode
}) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd
        className={cn(
          "m-0 flex min-w-0 items-center gap-1",
          mono ? "font-mono" : "tabular-nums"
        )}
      >
        <span className="truncate">{value}</span>
        {action}
      </dd>
    </>
  )
}
