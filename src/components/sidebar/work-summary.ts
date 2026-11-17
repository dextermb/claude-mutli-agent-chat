import type { AgentWithState } from "@/lib/agent-api"

export function workSummary(agents: AgentWithState[]) {
  const working = agents.filter((agent) => agent.state === "busy").length
  const waiting = agents.filter((agent) => agent.state === "waiting").length
  const parts = [
    working > 0 && `${working} ${working === 1 ? "agent" : "agents"} working`,
    waiting > 0 && `${waiting} needs approval`,
  ].filter((part): part is string => part !== false)
  if (parts.length === 0) return null
  return {
    parts,
    state: working > 0 ? ("busy" as const) : ("waiting" as const),
  }
}
