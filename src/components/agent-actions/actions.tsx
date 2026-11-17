import { RotateCcwIcon, SquareIcon } from "lucide-react"
import type { ReactNode } from "react"

export type Action = {
  route: "stop" | "restart"
  label: string
  pending: string
  icon: ReactNode
  variant: "destructive" | "outline"
  title: (name: string) => string
  description: (name: string) => string
  points: (name: string) => string[]
  done: (name: string) => string
}

export const ACTIONS: Action[] = [
  {
    route: "stop",
    label: "Stop agent",
    pending: "Stopping…",
    icon: <SquareIcon />,
    variant: "destructive",
    title: (name) => `Stop ${name}?`,
    description: (name) =>
      `The next message to ${name} starts it again, and it remembers each conversation.`,
    points: (name) => [
      "Each turn that runs now stops, in each conversation.",
      `A message that waits for ${name} does not get a reply.`,
    ],
    done: (name) => `${name} is stopped.`,
  },
  {
    route: "restart",
    label: "Restart session",
    pending: "Restarting…",
    icon: <RotateCcwIcon />,
    variant: "outline",
    title: (name) => `Restart ${name}?`,
    description: (name) =>
      `${name} starts again with the current configuration, and it remembers each conversation.`,
    points: (name) => [
      "Each turn that runs now stops, in each conversation.",
      `A message that waits for ${name} does not get a reply.`,
    ],
    done: (name) => `${name} starts again.`,
  },
]
