import { useContext } from "react"

import { WorkspaceContext } from "@/components/workspace/workspace-context"

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext)

  if (workspace === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider")
  }

  return workspace
}
