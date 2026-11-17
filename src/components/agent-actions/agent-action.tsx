import { useState } from "react"

import type { Action } from "@/components/agent-actions/actions"
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
import { refusalOf } from "@/lib/refusal"
import { toastDone, toastRefusal } from "@/lib/toasts"

export function AgentAction({
  action,
  agentId,
  agentName,
}: {
  action: Action
  agentId: string
  agentName: string
}) {
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState(false)

  async function run() {
    setPending(true)
    const reason = await refusalOf(
      fetch(`/api/agents/${agentId}/${action.route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    )
    setPending(false)
    setAsking(false)
    if (reason === null) toastDone(action.done(agentName))
    else toastRefusal(`${action.label} did not work.`, reason)
  }

  return (
    <AlertDialog open={asking} onOpenChange={setAsking}>
      <AlertDialogTrigger
        render={<Button type="button" variant={action.variant} />}
      >
        {action.icon}
        {action.label}
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{action.title(agentName)}</AlertDialogTitle>
          <AlertDialogDescription>
            {action.description(agentName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="m-0 flex flex-col gap-1 pl-[18px] text-[13px] leading-5 text-muted-foreground">
          {action.points(agentName).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={action.variant === "outline" ? "default" : action.variant}
            disabled={pending}
            onClick={() => void run()}
          >
            {pending ? <Spinner aria-hidden="true" /> : action.icon}
            {pending ? action.pending : action.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
