import { statusOf } from "@/components/conversation/agent-look"
import { workSummary } from "@/components/sidebar/work-summary"
import type { AgentWithState } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function WorkFooter({ agents }: { agents: AgentWithState[] }) {
  const work = workSummary(agents)
  if (!work) return null
  return (
    <p className="m-0 flex items-center gap-2 px-2 py-1 text-xs text-foreground-faint">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 flex-none rounded-full",
          statusOf(work.state).dot
        )}
      />
      {work.parts.join(" · ")}
    </p>
  )
}
