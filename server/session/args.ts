import { fileURLToPath } from "node:url"
import { CHAT_SERVER, READ_TOOLS } from "../mcp/tools.ts"

export type AgentConfig = {
  model: string
  permissionMode: string
  allowedTools: string[]
  disallowedTools: string[]
  systemPrompt: string | null
}

export type SessionContext = {
  rule: string
  chat: { url: string; token: string }
}

export type SessionRef = {
  claudeSessionId: string | null
  claudeSessionNew?: boolean
}

const PLUGIN_FOLDER = fileURLToPath(new URL("../../agent", import.meta.url))

export function buildArgs(
  agent: AgentConfig,
  session: SessionRef,
  context: SessionContext
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
    "--mcp-config",
    JSON.stringify({
      mcpServers: {
        [CHAT_SERVER]: {
          type: "http",
          url: context.chat.url,
          headers: { Authorization: `Bearer ${context.chat.token}` },
        },
      },
    }),
    "--model",
    agent.model,
    "--permission-mode",
    agent.permissionMode,
  ]
  args.push(
    "--allowedTools",
    ...agent.allowedTools,
    ...READ_TOOLS.map((tool) => `mcp__${CHAT_SERVER}__${tool}`)
  )
  if (agent.disallowedTools.length > 0) {
    args.push("--disallowedTools", ...agent.disallowedTools)
  }
  args.push(
    "--append-system-prompt",
    [context.rule, agent.systemPrompt].filter(Boolean).join("\n\n")
  )
  if (session.claudeSessionId) {
    args.push(
      session.claudeSessionNew ? "--session-id" : "--resume",
      session.claudeSessionId
    )
  }
  return args
}
