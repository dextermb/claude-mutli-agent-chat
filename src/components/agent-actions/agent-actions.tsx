import { AgentAction } from "@/components/agent-actions/agent-action"
import { ACTIONS } from "@/components/agent-actions/actions"

export function AgentActions({
  agentId,
  agentName,
}: {
  agentId: string
  agentName: string
}) {
  return ACTIONS.map((action) => (
    <AgentAction
      key={action.route}
      action={action}
      agentId={agentId}
      agentName={agentName}
    />
  ))
}
