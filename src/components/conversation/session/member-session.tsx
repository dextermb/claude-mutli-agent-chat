import { useState } from "react"

import { RefusalOf } from "@/components/conversation/session/refusal-of"
import { SessionActions } from "@/components/conversation/session/session-actions"
import type {
  Refusal,
  SessionDetailsProps,
} from "@/components/conversation/session/session-details"
import { SessionFacts } from "@/components/conversation/session/session-facts"

export function MemberSession(details: SessionDetailsProps) {
  const [refusal, setRefusal] = useState<Refusal>(null)
  return (
    <section
      aria-label={`Session of ${details.agentName}`}
      className="flex flex-col gap-3 px-3 pt-1 pb-3"
    >
      <RefusalOf refusal={refusal} onClose={() => setRefusal(null)} />
      <SessionFacts card={details.card} />
      <SessionActions {...details} onRefusal={setRefusal} />
    </section>
  )
}
