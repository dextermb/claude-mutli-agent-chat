import { SquareIcon } from "lucide-react"
import { useState } from "react"

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
import { refusalOf } from "@/lib/refusal"

export function StopAgent({
  agentId,
  agentName,
  onRefusal,
}: {
  agentId: string
  agentName: string
  onRefusal: (refusal: string | null) => void
}) {
  const [asking, setAsking] = useState(false)

  async function stop() {
    setAsking(false)
    onRefusal(
      await refusalOf(
        fetch(`/api/agents/${agentId}/stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      )
    )
  }

  return (
    <AlertDialog open={asking} onOpenChange={setAsking}>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" />}
      >
        <SquareIcon />
        Stop agent
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{`Stop ${agentName}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {`The next message to ${agentName} starts it again, and it remembers each conversation.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="m-0 flex flex-col gap-1 pl-[18px] text-[13px] leading-5 text-muted-foreground">
          <li>Each turn that runs now stops, in each conversation.</li>
          <li>{`A message that waits for ${agentName} does not get a reply.`}</li>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void stop()}>
            <SquareIcon />
            Stop agent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
