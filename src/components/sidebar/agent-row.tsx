import { statusOf } from "@/components/conversation/agent-look"
import { ConversationRow } from "@/components/sidebar/conversation-row"
import { DeleteAction, type Deletion } from "@/components/sidebar/delete-action"
import { ROW_CLASS } from "@/components/sidebar/row-class"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { cn } from "@/lib/utils"
import { shownName } from "../../../server/agent-names.ts"

export function AgentRow({
  agent,
  directMessage,
  current,
  unread,
  onNavigate,
  onOpenDirectMessage,
  deletion,
}: {
  agent: AgentWithState
  directMessage: Conversation | undefined
  current: boolean
  unread: number
  onNavigate: () => void
  onOpenDirectMessage: () => void
  deletion: Deletion
}) {
  const status = statusOf(agent.state)
  const label = (
    <>
      <span
        aria-hidden="true"
        className={cn("mx-1 size-2 flex-none rounded-full", status.dot)}
      />
      <span>{shownName(agent)}</span>{" "}
      <span className="sr-only">{status.label}</span>
    </>
  )
  if (directMessage) {
    return (
      <ConversationRow
        conversation={directMessage}
        current={current}
        unread={unread}
        onNavigate={onNavigate}
        deletion={deletion}
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
      <DeleteAction deletion={deletion} />
    </SidebarMenuItem>
  )
}
