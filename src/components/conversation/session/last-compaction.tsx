import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { SessionCard } from "@/lib/agent-api"
import { clockTime } from "@/lib/time"
import { cn } from "@/lib/utils"

export function LastCompaction({
  compaction,
}: {
  compaction: NonNullable<SessionCard["lastCompaction"]>
}) {
  const [open, setOpen] = useState(false)
  const count = (value: number) => value.toLocaleString("en-GB")
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col items-start gap-1 text-[13px]"
    >
      <p className="m-0 text-muted-foreground tabular-nums">
        {`Compacted at ${clockTime(compaction.at)} · ${count(compaction.preTokens)} → ${count(compaction.postTokens)} tokens`}
      </p>
      <CollapsibleTrigger
        render={<Button variant="ghost" size="xs" className="-ml-2" />}
      >
        {open ? "Hide the summary" : "Show the summary"}
        <ChevronDownIcon
          data-icon="inline-end"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-64 w-full overflow-y-auto rounded-md bg-muted p-2 text-xs leading-5 whitespace-pre-wrap">
        {compaction.summary}
      </CollapsibleContent>
    </Collapsible>
  )
}
