import { TriangleAlertIcon, XIcon } from "lucide-react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function RefusalAlert({
  title,
  refusal,
  onClose,
}: {
  title?: string
  refusal: string
  onClose?: () => void
}) {
  return (
    <Alert
      variant="destructive"
      className="rounded-lg border-destructive bg-error-soft text-[13px] leading-5"
    >
      <TriangleAlertIcon aria-hidden="true" />
      {title && (
        <AlertTitle className="font-semibold text-foreground-strong">
          {title}
        </AlertTitle>
      )}
      <AlertDescription className="text-[13px] text-foreground">
        {refusal}
      </AlertDescription>
      {onClose && (
        <AlertAction>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close the alert"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
