import { RotateCcwIcon, SquareIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

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

export type ActionRefusal = { title: string; reason: string }

type Action = {
  route: "stop" | "restart"
  label: string
  icon: ReactNode
  variant: "destructive" | "outline"
  title: (name: string) => string
  description: (name: string) => string
  points: (name: string) => string[]
}

const ACTIONS: Action[] = [
  {
    route: "stop",
    label: "Stop agent",
    icon: <SquareIcon />,
    variant: "destructive",
    title: (name) => `Stop ${name}?`,
    description: (name) =>
      `The next message to ${name} starts it again, and it remembers each conversation.`,
    points: (name) => [
      "Each turn that runs now stops, in each conversation.",
      `A message that waits for ${name} does not get a reply.`,
    ],
  },
  {
    route: "restart",
    label: "Restart session",
    icon: <RotateCcwIcon />,
    variant: "outline",
    title: (name) => `Restart ${name}?`,
    description: (name) =>
      `${name} starts again with the current configuration, and it remembers each conversation.`,
    points: (name) => [
      "Each turn that runs now stops, in each conversation.",
      `A message that waits for ${name} does not get a reply.`,
    ],
  },
]

export function AgentActions({
  agentId,
  agentName,
  onRefusal,
}: {
  agentId: string
  agentName: string
  onRefusal: (refusal: ActionRefusal | null) => void
}) {
  return ACTIONS.map((action) => (
    <AgentAction
      key={action.route}
      action={action}
      agentId={agentId}
      agentName={agentName}
      onRefusal={onRefusal}
    />
  ))
}

function AgentAction({
  action,
  agentId,
  agentName,
  onRefusal,
}: {
  action: Action
  agentId: string
  agentName: string
  onRefusal: (refusal: ActionRefusal | null) => void
}) {
  const [asking, setAsking] = useState(false)

  async function run() {
    setAsking(false)
    const reason = await refusalOf(
      fetch(`/api/agents/${agentId}/${action.route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    )
    onRefusal(
      reason === null
        ? null
        : { title: `${action.label} did not work.`, reason }
    )
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={action.variant === "outline" ? "default" : action.variant}
            onClick={() => void run()}
          >
            {action.icon}
            {action.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
