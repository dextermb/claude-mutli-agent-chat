import type { SessionCard } from "@/lib/agent-api"

export type Refusal = { title: string; reason: string } | null

export type SessionDetailsProps = {
  card: SessionCard | null
  agentName: string
  working: boolean
  onStopTurn: () => Promise<string | null>
  onNewSession: () => Promise<string | null>
  onRemove?: () => Promise<string | null>
}
