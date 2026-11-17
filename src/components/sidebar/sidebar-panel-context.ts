import { createContext } from "react"

export type SidebarPanel = {
  open: boolean
  setOpen: (open: boolean) => void
}

export const SidebarPanelContext = createContext<SidebarPanel | null>(null)
