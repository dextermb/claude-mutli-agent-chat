import { SidebarPanelProvider } from "@/components/sidebar/sidebar-panel-provider"
import { Toaster } from "@/components/ui/toast"
import { WorkspaceProvider } from "@/components/workspace/workspace-provider"
import { FileRouter } from "@/router/file-router"

export function App() {
  return (
    <Toaster>
      <WorkspaceProvider>
        <SidebarPanelProvider>
          <FileRouter />
        </SidebarPanelProvider>
      </WorkspaceProvider>
    </Toaster>
  )
}

export default App
