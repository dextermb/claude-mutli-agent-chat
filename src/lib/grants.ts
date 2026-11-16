import type { Json } from "@/lib/agent-api"

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
