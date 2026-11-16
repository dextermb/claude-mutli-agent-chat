import { createContext } from "react"

import type {
  AgentWithState,
  SharedFileView,
  TimelineEntry,
} from "@/lib/agent-api"

export type SharedFilesState = {
  files: SharedFileView[]
  entries: TimelineEntry[]
  agents: AgentWithState[]
}

export const SharedFilesContext = createContext<SharedFilesState>({
  files: [],
  entries: [],
  agents: [],
})
