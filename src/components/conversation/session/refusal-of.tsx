import { RefusalAlert } from "@/components/alerts/refusal-alert"
import type { Refusal } from "@/components/conversation/session/session-details"

export function RefusalOf({
  refusal,
  onClose,
}: {
  refusal: Refusal
  onClose: () => void
}) {
  if (!refusal) return null
  return (
    <RefusalAlert
      title={refusal.title}
      refusal={refusal.reason}
      onClose={onClose}
    />
  )
}
