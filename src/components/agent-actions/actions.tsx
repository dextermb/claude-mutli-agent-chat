import { RotateCcwIcon, SquareIcon } from "lucide-react"
import type { ReactNode } from "react"

export type ActionRefusal = { title: string; reason: string }

export type Action = {
  route: "stop" | "restart"
  label: string
  icon: ReactNode
  variant: "destructive" | "outline"
  title: (name: string) => string
  description: (name: string) => string
  points: (name: string) => string[]
}

export const ACTIONS: Action[] = [
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
