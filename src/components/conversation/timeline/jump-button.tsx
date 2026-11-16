import { ArrowDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function JumpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Jump to the latest message"
      onClick={onClick}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md dark:bg-background dark:hover:bg-muted"
    >
      <ArrowDownIcon />
    </Button>
  )
}
