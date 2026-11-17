import { useContext } from "react"

import { SidebarPanelContext } from "@/components/sidebar/sidebar-panel-context"

export function useSidebarPanel() {
  const panel = useContext(SidebarPanelContext)
  if (!panel) {
    throw new Error("useSidebarPanel needs a SidebarPanelProvider.")
  }
  return panel
}
