import { useEffect, useMemo, useState, type ReactNode } from "react"

import { SidebarPanelContext } from "@/components/sidebar/sidebar-panel-context"

const STORAGE_KEY = "sidebar-open"

function lastOpen() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false"
  } catch {
    return true
  }
}

function remember(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(open))
  } catch {
    return
  }
}

export function SidebarPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(lastOpen)

  useEffect(() => {
    remember(open)
  }, [open])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "b") return
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      setOpen((open) => !open)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const panel = useMemo(() => ({ open, setOpen }), [open])

  return (
    <SidebarPanelContext.Provider value={panel}>
      {children}
    </SidebarPanelContext.Provider>
  )
}
