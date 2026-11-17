import { createContext } from "react"

import type { AgentWithState, Conversation } from "@/lib/agent-api"

export type Workspace = {
  conversations: Conversation[]
  agents: AgentWithState[]
  unread: Record<string, number>
  loaded: boolean
}

export const WorkspaceContext = createContext<Workspace | undefined>(undefined)
