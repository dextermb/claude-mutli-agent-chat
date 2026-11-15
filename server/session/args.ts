import { fileURLToPath } from "node:url"
import { CHAT_SERVER } from "../mcp/names.ts"
import { claudeArgs, type AgentConfig, type SessionRef } from "./claude-args.ts"

export type { AgentConfig, SessionRef } from "./claude-args.ts"

export type SessionContext = {
  rule: string
  chat: { url: string; token: string }
}

const PLUGIN_FOLDER = fileURLToPath(new URL("../../agent", import.meta.url))

export function buildArgs(
  agent: AgentConfig,
  session: SessionRef,
  context: SessionContext
): string[] {
  return claudeArgs(agent, session, {
    pluginDir: PLUGIN_FOLDER,
    mcpConfig: JSON.stringify({
      mcpServers: {
        [CHAT_SERVER]: {
          type: "http",
          url: context.chat.url,
          headers: { Authorization: `Bearer ${context.chat.token}` },
        },
      },
    }),
    systemPrompt: [context.rule, agent.systemPrompt]
      .filter(Boolean)
      .join("\n\n"),
  })
}
