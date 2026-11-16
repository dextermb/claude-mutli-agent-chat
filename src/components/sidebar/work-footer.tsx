import { statusOf } from "@/components/conversation/agent-look"
import type { AgentWithState } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function WorkFooter({ agents }: { agents: AgentWithState[] }) {
  const working = agents.filter((agent) => agent.state === "busy").length
  const waiting = agents.filter((agent) => agent.state === "waiting").length
  const parts = [
    working > 0 && `${working} ${working === 1 ? "agent" : "agents"} working`,
    waiting > 0 && `${waiting} needs approval`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="m-0 flex items-center gap-2 px-2 py-1 text-xs text-foreground-faint">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 flex-none rounded-full",
          statusOf(working > 0 ? "busy" : "waiting").dot
        )}
      />
      {parts.join(" · ")}
    </p>
  )
}
