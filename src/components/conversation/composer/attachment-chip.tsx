import { FileIcon, FolderIcon, RotateCcwIcon, XIcon } from "lucide-react"

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
import { Progress } from "@/components/ui/progress"
import type { Attachment } from "@/hooks/use-attachments"
import { formatSize } from "@/lib/format-size"
import { cn } from "@/lib/utils"

const BADGES: Record<
  Attachment["status"],
  { text: string; className: string }
> = {
  finding: { text: "Finding", className: "text-muted-foreground" },
  linked: { text: "Linked", className: "text-status-online" },
  copied: { text: "Copied", className: "text-muted-foreground" },
  copying: { text: "Copy", className: "text-status-working" },
  refused: { text: "Refused", className: "text-status-error" },
  failed: { text: "Failed", className: "text-status-error" },
}

export function AttachmentChip({
  item,
  onRemove,
  onRetry,
}: {
  item: Attachment
  onRemove: () => void
  onRetry: () => void
}) {
  const badge = BADGES[item.status]
  const problem = item.status === "refused" || item.status === "failed"
  return (
    <Item
      size="sm"
      variant="outline"
      className={cn(
        "flex-nowrap bg-rail",
        problem && "border-destructive bg-error-soft"
      )}
    >
      <ItemMedia variant="icon">
        {item.status === "refused" ? <FolderIcon /> : <FileIcon />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <span className="truncate">{item.name}</span>
          <Badge variant="outline" className={badge.className}>
            {item.status === "copying"
              ? `Copy: ${Math.round(item.progress * 100)}%`
              : badge.text}
          </Badge>
        </ItemTitle>
        <ItemDescription
          className={cn("truncate", item.path && !problem && "font-mono")}
        >
          {item.problem ?? item.path ?? formatSize(item.size)}
        </ItemDescription>
        {item.status === "copying" && (
          <Progress
            value={Math.round(item.progress * 100)}
            aria-label={`Copy of ${item.name}`}
          />
        )}
      </ItemContent>
      <ItemActions>
        {item.status === "failed" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Retry ${item.name}`}
            onClick={onRetry}
          >
            <RotateCcwIcon />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </ItemActions>
    </Item>
  )
}
