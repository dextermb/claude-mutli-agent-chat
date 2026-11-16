import { statusOf } from "@/components/conversation/agent-look"
import { ConversationRow } from "@/components/sidebar/conversation-row"
import { ROW_CLASS } from "@/components/sidebar/row-class"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function AgentRow({
  agent,
  directMessage,
  current,
  unread,
  onNavigate,
  onOpenDirectMessage,
}: {
  agent: AgentWithState
  directMessage: Conversation | undefined
  current: boolean
  unread: number
  onNavigate: () => void
  onOpenDirectMessage: () => void
}) {
  const status = statusOf(agent.state)
  const label = (
    <>
      <span
        aria-hidden="true"
        className={cn("mx-1 size-2 flex-none rounded-full", status.dot)}
      />
      <span>{agent.name}</span> <span className="sr-only">{status.label}</span>
    </>
  )
  if (directMessage) {
    return (
      <ConversationRow
        conversation={directMessage}
        current={current}
        unread={unread}
        onNavigate={onNavigate}
      >
        {label}
      </ConversationRow>
    )
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton className={ROW_CLASS} onClick={onOpenDirectMessage}>
        {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
