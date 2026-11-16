import { CopyIcon, FileIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { SharedFile } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export type SharedFileState = "linked" | "copied" | "removed" | "missing"

const BADGES: Record<SharedFileState, { text: string; className: string }> = {
  linked: { text: "Linked", className: "text-status-online" },
  copied: { text: "Copied", className: "text-muted-foreground" },
  removed: { text: "Removed", className: "text-muted-foreground" },
  missing: { text: "Missing", className: "text-status-error" },
}

export function SharedFileRow({
  file,
  state,
  note,
  canCopy,
  action,
}: {
  file: Pick<SharedFile, "name" | "path">
  state: SharedFileState
  note: string
  canCopy: boolean
  action?: ReactNode
}) {
  const badge = BADGES[state]
  return (
    <Item
      size="sm"
      variant="outline"
      className={cn(
        "flex-nowrap bg-rail",
        (state === "removed" || state === "missing") && "opacity-70"
      )}
    >
      <ItemMedia variant="icon">
        <FileIcon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <span className="truncate">{file.name}</span>
          <Badge variant="outline" className={badge.className}>
            {badge.text}
          </Badge>
        </ItemTitle>
        <ItemDescription className="truncate font-mono">
          {file.path}
        </ItemDescription>
        <ItemDescription
          className={cn(state === "missing" && "text-status-error")}
        >
          {note}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {canCopy && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Copy the path of ${file.name}`}
                  onClick={() => {
                    void navigator.clipboard.writeText(file.path)
                  }}
                />
              }
            >
              <CopyIcon />
            </TooltipTrigger>
            <TooltipContent>Copy the path</TooltipContent>
          </Tooltip>
        )}
        {action}
      </ItemActions>
    </Item>
  )
}
