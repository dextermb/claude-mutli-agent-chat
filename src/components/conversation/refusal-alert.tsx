import { XIcon } from "lucide-react"

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function RefusalAlert({
  refusal,
  onClose,
}: {
  refusal: string
  onClose: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{refusal}</AlertDescription>
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  )
}
