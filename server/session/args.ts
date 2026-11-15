import { fileURLToPath } from "node:url"

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

const PLUGIN_FOLDER = fileURLToPath(new URL("../../agent", import.meta.url))

export function buildArgs(
  agent: AgentConfig,
  session: SessionRef,
  environment: string
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
    PLUGIN_FOLDER,
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
  args.push(
    "--append-system-prompt",
    [environment, agent.systemPrompt].filter(Boolean).join("\n\n")
  )
  if (session.claudeSessionId) {
    args.push(
      session.claudeSessionNew ? "--session-id" : "--resume",
      session.claudeSessionId
    )
  }
  return args
}
