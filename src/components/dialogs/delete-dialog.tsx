import { Trash2Icon } from "lucide-react"
import { useState } from "react"

import { RefusalAlert } from "@/components/alerts/refusal-alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import type { DeleteTarget } from "@/lib/delete-targets"
import { refusalOf } from "@/lib/refusal"
import { toastDone } from "@/lib/toasts"

export function DeleteDialog({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: DeleteTarget | null
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [pending, setPending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function remove(deleting: DeleteTarget) {
    setPending(true)
    const refused = await refusalOf(fetch(deleting.url, { method: "DELETE" }))
    setPending(false)
    setRefusal(refused)
    if (refused) return
    toastDone(deleting.done)
    onDeleted()
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setRefusal(null)
        onOpenChange(open)
      }}
    >
      {target && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target.title}</AlertDialogTitle>
            <AlertDialogDescription>
              You cannot undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex list-disc flex-col gap-1 pl-[18px] text-[13px] leading-5 text-muted-foreground">
            {target.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {refusal && (
            <RefusalAlert
              title={`${target.action} did not work.`}
              refusal={refusal}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => void remove(target)}
            >
              {pending ? <Spinner /> : <Trash2Icon />}
              {target.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
