import { ScrollTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function RulesBadge({
  rules,
  onOpen,
}: {
  rules: string
  onOpen: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            render={<button type="button" onClick={onOpen} />}
          />
        }
      >
        <ScrollTextIcon />
        Rules
      </TooltipTrigger>
      <TooltipContent className="line-clamp-6 max-w-80 whitespace-pre-line">
        {rules}
      </TooltipContent>
    </Tooltip>
  )
}
