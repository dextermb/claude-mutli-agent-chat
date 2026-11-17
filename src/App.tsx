import { Toaster } from "@/components/ui/toast"
import { FileRouter } from "@/router/file-router"

export function App() {
  return (
    <Toaster>
      <FileRouter />
    </Toaster>
  )
}

export default App
