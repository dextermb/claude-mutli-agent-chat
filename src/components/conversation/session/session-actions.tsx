import { RotateCcwIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import type {
  Refusal,
  SessionDetailsProps,
} from "@/components/conversation/session/session-details"
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

export function SessionActions({
  agentName,
  working,
  onStopTurn,
  onNewSession,
  onRemove,
  onRefusal,
}: SessionDetailsProps & { onRefusal: (refusal: Refusal) => void }) {
  const [asking, setAsking] = useState(false)
  async function act(title: string, action: () => Promise<string | null>) {
    const reason = await action()
    onRefusal(reason === null ? null : { title, reason })
  }
  return (
    <div className="flex flex-wrap gap-2">
      {working && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void act("Stop turn did not work.", onStopTurn)}
        >
          <SquareIcon />
          Stop turn
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAsking(false)
                void act("New session did not work.", onNewSession)
              }}
            >
              <RotateCcwIcon />
              Start new session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void act("Remove did not work.", onRemove)}
        >
          <Trash2Icon />
          Remove
        </Button>
      )}
    </div>
  )
}
