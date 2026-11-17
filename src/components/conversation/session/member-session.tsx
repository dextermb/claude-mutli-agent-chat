import { SessionActions } from "@/components/conversation/session/session-actions"
import type { SessionDetailsProps } from "@/components/conversation/session/session-details"
import { SessionFacts } from "@/components/conversation/session/session-facts"

export function MemberSession(details: SessionDetailsProps) {
  return (
    <section
      aria-label={`Session of ${details.agentName}`}
      className="flex flex-col gap-3 px-3 pt-1 pb-3"
    >
      <SessionFacts card={details.card} />
      <SessionActions {...details} />
    </section>
  )
}
