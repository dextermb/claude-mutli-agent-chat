import { RotateCcwIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import type { SessionDetailsProps } from "@/components/conversation/session/session-details"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toastDone, toastRefusal } from "@/lib/toasts"

type Action = "stop" | "new" | "remove"

export function SessionActions({
  agentName,
  working,
  onStopTurn,
  onNewSession,
  onRemove,
}: SessionDetailsProps) {
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState<Action | null>(null)
  async function act(
    which: Action,
    title: string,
    done: string,
    action: () => Promise<string | null>
  ) {
    setPending(which)
    const reason = await action()
    setPending(null)
    if (reason === null) toastDone(done)
    else toastRefusal(title, reason)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {working && (
        <Button
          variant="destructive"
          size="sm"
          disabled={pending !== null}
          onClick={() =>
            void act(
              "stop",
              "Stop turn did not work.",
              `The turn of ${agentName} is stopped.`,
              onStopTurn
            )
          }
        >
          {pending === "stop" ? <Spinner aria-hidden="true" /> : <SquareIcon />}
          {pending === "stop" ? "Stopping…" : "Stop turn"}
        </Button>
      )}
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
          <RotateCcwIcon />
          New session
        </AlertDialogTrigger>
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new session?</AlertDialogTitle>
            <AlertDialogDescription>
              {`${agentName} forgets this conversation. The messages stay here.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="m-0 flex flex-col gap-1 pl-[18px] text-[13px] leading-5 text-muted-foreground">
            <li>
              {`The turn that runs now stops. A message that waits for ${agentName} does not get a reply.`}
            </li>
            <li>{`The new process uses the current configuration of ${agentName}.`}</li>
            <li>A divider marks the new session in the timeline.</li>
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending === "new"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending === "new"}
              onClick={() => {
                void act(
                  "new",
                  "New session did not work.",
                  `A new session of ${agentName} is started.`,
                  onNewSession
                ).then(() => setAsking(false))
              }}
            >
              {pending === "new" ? (
                <Spinner aria-hidden="true" />
              ) : (
                <RotateCcwIcon />
              )}
              {pending === "new" ? "Starting…" : "Start new session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={() =>
            void act(
              "remove",
              "Remove did not work.",
              `${agentName} is removed.`,
              onRemove
            )
          }
        >
          {pending === "remove" ? (
            <Spinner aria-hidden="true" />
          ) : (
            <Trash2Icon />
          )}
          {pending === "remove" ? "Removing…" : "Remove"}
        </Button>
      )}
    </div>
  )
}
