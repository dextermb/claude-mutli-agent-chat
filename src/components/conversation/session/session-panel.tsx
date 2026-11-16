import { useState } from "react"

import { AllowedTools } from "@/components/conversation/session/allowed-tools"
import { RefusalOf } from "@/components/conversation/session/refusal-of"
import { SessionActions } from "@/components/conversation/session/session-actions"
import type {
  Refusal,
  SessionDetailsProps,
} from "@/components/conversation/session/session-details"
import { SessionFacts } from "@/components/conversation/session/session-facts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SessionPanel(details: SessionDetailsProps) {
  const [refusal, setRefusal] = useState<Refusal>(null)
  return (
    <aside
      aria-label="Session"
      className="flex w-[340px] flex-none flex-col gap-4 overflow-y-auto border-l p-4"
    >
      <h2 className="m-0 px-1 text-sm font-semibold text-foreground-strong">
        Session
      </h2>
      <RefusalOf refusal={refusal} onClose={() => setRefusal(null)} />
      <Card size="sm">
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>One headless Claude Code process.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SessionFacts card={details.card} withModel />
        </CardContent>
        <CardFooter>
          <SessionActions {...details} onRefusal={setRefusal} />
        </CardFooter>
      </Card>
      {details.card && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Allowed tools</CardTitle>
            <CardDescription>
              Other tools wait for your approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllowedTools tools={details.card.allowedTools} />
          </CardContent>
        </Card>
      )}
    </aside>
  )
}
