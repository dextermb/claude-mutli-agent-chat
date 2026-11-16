import { PaperclipIcon } from "lucide-react"
import { useEffect, useState, type DragEvent } from "react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import type { useAttachments } from "@/hooks/use-attachments"
import { draggedPath, endPathDrag, PATH_TYPE } from "@/lib/drag-path"

type Drag = { kind: "files" } | { kind: "path"; path: string | null }

export function useDropZone(
  attachments: ReturnType<typeof useAttachments>,
  target: string
) {
  const [drag, setDrag] = useState<Drag | null>(null)

  useEffect(() => {
    if (!drag) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drag])

  function kindOf(event: DragEvent): Drag | null {
    const types = [...(event.dataTransfer?.types ?? [])]
    if (types.includes(PATH_TYPE)) return { kind: "path", path: draggedPath() }
    if (types.includes("Files")) return { kind: "files" }
    return null
  }

  const handlers = {
    onDragEnter: (event: DragEvent) => {
      const next = kindOf(event)
      if (!next) return
      event.preventDefault()
      setDrag(next)
    },
    onDragOver: (event: DragEvent) => {
      if (kindOf(event)) event.preventDefault()
    },
    onDragLeave: (event: DragEvent) => {
      if (event.relatedTarget === null) setDrag(null)
    },
    onDrop: (event: DragEvent) => {
      const kind = kindOf(event)
      if (!kind) return
      event.preventDefault()
      setDrag(null)
      if (kind.kind === "path") {
        const path = event.dataTransfer.getData(PATH_TYPE) || kind.path
        if (path) attachments.addPath(path)
        endPathDrag()
        return
      }
      attachments.addFiles(
        [...event.dataTransfer.items].flatMap((item) => {
          const file = item.kind === "file" ? item.getAsFile() : null
          if (!file) return []
          const entry = item.webkitGetAsEntry?.()
          return [{ file, isFolder: entry?.isDirectory === true }]
        })
      )
    },
  }

  const overlay = drag && (
    <div
      role="region"
      aria-label="Drop zone"
      className="absolute inset-x-4 inset-y-3 z-10 flex items-center justify-center rounded-[18px] border-2 border-dashed border-primary bg-background/90 p-6"
    >
      <Empty className="max-w-[460px] border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PaperclipIcon />
          </EmptyMedia>
          <EmptyTitle>
            {drag.kind === "path"
              ? `Drop to add ${drag.path ?? "this path"}`
              : `Drop to share with ${target}`}
          </EmptyTitle>
          <EmptyDescription>
            {drag.kind === "path"
              ? "The app knows this path, so nothing is copied. The path goes into your message."
              : "The app finds each file, or copies it. Then the path goes into your message."}
          </EmptyDescription>
        </EmptyHeader>
        {drag.kind === "files" && (
          <div className="flex w-full flex-col gap-2 text-left">
            <Item size="sm" variant="outline" className="bg-rail">
              <ItemContent>
                <ItemTitle>Linked</ItemTitle>
                <ItemDescription>
                  A file that is in the folder of an agent stays where it is.
                  The agent changes the real file.
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item size="sm" variant="outline" className="bg-rail">
              <ItemContent>
                <ItemTitle>Copied</ItemTitle>
                <ItemDescription>
                  {`Any other file goes to the uploads of ${target}. Each agent here can read it.`}
                </ItemDescription>
              </ItemContent>
            </Item>
          </div>
        )}
        <p className="m-0 flex items-center gap-1.5 text-xs text-foreground-faint">
          Press <Kbd>Esc</Kbd> to cancel.
        </p>
      </Empty>
    </div>
  )

  return { handlers, overlay }
}
