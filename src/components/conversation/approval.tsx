import { useId } from "react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { Json, PermissionItem } from "@/lib/agent-api"

const DONE_LABEL: Record<
  Exclude<PermissionItem["status"], "pending">,
  string
> = {
  allowed: "Allowed",
  denied: "Denied",
  expired: "Expired",
}

export function Approval({
  request,
  label,
  agentName,
  onAnswer,
}: {
  request: PermissionItem
  label: string
  agentName: string
  onAnswer: (requestId: string, answer: RequestAnswer) => void
}) {
  const grantsId = useId()
  const answer = (decision: "allow_once" | "always_allow" | "deny") =>
    onAnswer(request.requestId, { decision })
  return (
    <div
      role="region"
      aria-label={`Approval for ${label}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background px-2.5 py-2 font-sans"
    >
      {request.status === "pending" ? (
        <>
          <span className="min-w-[200px] flex-1 text-[13px]">
            This tool is not in the allowed tools of {agentName}.
          </span>
          <ButtonGroup>
            <Button variant="outline" size="sm" onClick={() => answer("deny")}>
              Deny
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => answer("allow_once")}
            >
              Allow once
            </Button>
            {request.suggestions.length > 0 && (
              <Button
                size="sm"
                aria-describedby={grantsId}
                onClick={() => answer("always_allow")}
              >
                Always allow
              </Button>
            )}
          </ButtonGroup>
          {request.suggestions.length > 0 && (
            <span
              id={grantsId}
              className="w-full text-xs leading-[18px] text-foreground-faint"
            >
              <span aria-hidden="true">Always allow: </span>
              {describeGrants(request.suggestions, agentName)}
            </span>
          )}
        </>
      ) : (
        <span className="text-[13px] text-muted-foreground">
          {DONE_LABEL[request.status]}
        </span>
      )}
    </div>
  )
}

export function describeGrants(suggestions: Json[], agentName: string): string {
  return suggestions
    .map((suggestion) => describeGrant(suggestion, agentName))
    .join(" ")
}

function describeGrant(suggestion: Json, agentName: string): string {
  const until =
    suggestion.destination === "session"
      ? "until the session ends."
      : "with no time limit."
  if (suggestion.type === "setMode") {
    return suggestion.mode === "acceptEdits"
      ? `Lets ${agentName} edit files with no request ${until}`
      : `Changes the mode of ${agentName} to ${String(suggestion.mode)} ${until}`
  }
  const rules = Array.isArray(suggestion.rules) ? suggestion.rules : []
  const names = rules.map((rule: Json) =>
    rule.ruleContent
      ? `${String(rule.toolName)}(${String(rule.ruleContent)})`
      : String(rule.toolName)
  )
  const stays =
    suggestion.destination === "session"
      ? "The rule ends with the session."
      : suggestion.destination === "userSettings"
        ? "The rule stays in your user settings."
        : "The rule stays in the folder of the agent."
  return `Lets ${agentName} run ${names.join(", ")} with no request. ${stays}`
}
