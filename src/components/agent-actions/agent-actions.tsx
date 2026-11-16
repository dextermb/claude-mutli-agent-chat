import { AgentAction } from "@/components/agent-actions/agent-action"
import { ACTIONS, type ActionRefusal } from "@/components/agent-actions/actions"

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
