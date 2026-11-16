import { CopyIcon, InfoIcon, MoonIcon } from "lucide-react"

import { FactRow } from "@/components/conversation/session/fact-row"
import { LastCompaction } from "@/components/conversation/session/last-compaction"
import { Button } from "@/components/ui/button"
import type { SessionCard } from "@/lib/agent-api"
import { contextPercent, contextTokens } from "@/lib/context"
import { formatCost } from "@/lib/cost"
import { clockTime } from "@/lib/time"

export function SessionFacts({
  card,
  withModel = false,
}: {
  card: SessionCard | null
  withModel?: boolean
}) {
  if (!card) return null
  return (
    <>
      {card.configChanged && (
        <p className="m-0 flex items-start gap-2 rounded-[10px] bg-mention-soft px-2.5 py-2 text-[13px] leading-5 text-foreground-strong">
          <InfoIcon
            aria-hidden="true"
            className="mt-0.5 size-4 flex-none text-mention"
          />
          The configuration changed. Start a new session to use it.
        </p>
      )}
      {card.asleepSince && (
        <p className="m-0 flex items-start gap-2 rounded-[10px] bg-muted px-2.5 py-2 text-[13px] leading-5 text-muted-foreground">
          <MoonIcon aria-hidden="true" className="mt-0.5 size-4 flex-none" />
          {`Asleep since ${clockTime(card.asleepSince)}. The next message wakes it.`}
        </p>
      )}
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-[13px]">
        {withModel && <FactRow term="Model" value={card.model} mono />}
        <FactRow term="Permissions" value={card.permissionMode} mono />
        <FactRow term="Directory" value={card.directory} mono />
        <FactRow
          term="Session ID"
          value={card.claudeSessionId?.slice(0, 8) ?? "None yet"}
          mono
          action={
            card.claudeSessionId && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy session ID"
                onClick={() => {
                  void navigator.clipboard.writeText(card.claudeSessionId ?? "")
                }}
              >
                <CopyIcon />
              </Button>
            )
          }
        />
        <FactRow term="Turns" value={String(card.turns)} />
        <FactRow term="Cost" value={formatCost(card.costUsd)} />
        {card.context && (
          <FactRow
            term="Context"
            value={`${contextPercent(card.context)}% · ${contextTokens(card.context)}`}
          />
        )}
      </dl>
      {card.lastCompaction && (
        <LastCompaction compaction={card.lastCompaction} />
      )}
    </>
  )
}
