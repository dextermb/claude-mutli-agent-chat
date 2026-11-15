import { CHAT_SERVER, READ_TOOLS } from "../mcp/names.ts"

export type AgentConfig = {
  model: string
  permissionMode: string
  allowedTools: string[]
  disallowedTools: string[]
  systemPrompt: string | null
}

export type SessionRef = {
  claudeSessionId: string | null
  claudeSessionNew?: boolean
}

export type SessionValues = {
  pluginDir: string
  mcpConfig: string
  systemPrompt: string
}

export function claudeArgs(
  agent: AgentConfig,
  session: SessionRef,
  values: SessionValues
): string[] {
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
    "--plugin-dir",
    values.pluginDir,
    "--mcp-config",
    values.mcpConfig,
    "--model",
    agent.model,
    "--permission-mode",
    agent.permissionMode,
    "--allowedTools",
    ...agent.allowedTools,
    ...READ_TOOLS.map((tool) => `mcp__${CHAT_SERVER}__${tool}`),
  ]
  if (agent.disallowedTools.length > 0) {
    args.push("--disallowedTools", ...agent.disallowedTools)
  }
  args.push("--append-system-prompt", values.systemPrompt)
  if (session.claudeSessionId) {
    args.push(
      session.claudeSessionNew ? "--session-id" : "--resume",
      session.claudeSessionId
    )
  }
  return args
}
