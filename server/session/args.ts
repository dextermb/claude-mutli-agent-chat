export type AgentConfig = {
  model: string
  permissionMode: string
  allowedTools: string[]
  disallowedTools: string[]
  systemPrompt: string | null
}

export type SessionRef = { claudeSessionId: string | null }

export function buildArgs(agent: AgentConfig, session: SessionRef): string[] {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--replay-user-messages",
    "--permission-prompt-tool",
    "stdio",
    "--setting-sources",
    "user,project",
    "--model",
    agent.model,
    "--permission-mode",
    agent.permissionMode,
  ]
  if (agent.allowedTools.length > 0) {
    args.push("--allowedTools", ...agent.allowedTools)
  }
  if (agent.disallowedTools.length > 0) {
    args.push("--disallowedTools", ...agent.disallowedTools)
  }
  if (agent.systemPrompt) {
    args.push("--append-system-prompt", agent.systemPrompt)
  }
  if (session.claudeSessionId) {
    args.push("--resume", session.claudeSessionId)
  }
  return args
}
