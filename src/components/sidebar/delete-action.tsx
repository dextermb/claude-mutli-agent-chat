import { XIcon } from "lucide-react"

import { SidebarMenuAction } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type Deletion = { label: string; hint: string; onClick: () => void }

export function DeleteAction({ deletion }: { deletion: Deletion }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarMenuAction
            showOnHover
            aria-label={deletion.label}
            onClick={deletion.onClick}
          />
        }
      >
        <XIcon />
      </TooltipTrigger>
      <TooltipContent side="right">{deletion.hint}</TooltipContent>
    </Tooltip>
  )
}
