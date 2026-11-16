import { CopyIcon } from "lucide-react"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ONE_LINE_HEIGHT = 26

export function AgentReply({
  text,
  done,
  children,
}: {
  text: string
  done: boolean
  children: ReactNode
}) {
  const textRef = useRef<HTMLDivElement>(null)
  const [oneLine, setOneLine] = useState(true)

  useLayoutEffect(() => {
    const element = textRef.current
    if (!element) return
    const measure = () => setOneLine(element.offsetHeight <= ONE_LINE_HEIGHT)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      data-lines={oneLine ? "one" : "many"}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1"
    >
      <div ref={textRef} className="min-w-0">
        {children}
      </div>
      {done && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Copy the message"
          className={cn(
            "text-muted-foreground",
            oneLine
              ? "col-start-2 row-start-1 mt-px"
              : "col-start-1 row-start-2 -ml-1.5"
          )}
          onClick={() => {
            void navigator.clipboard.writeText(text)
          }}
        >
          <CopyIcon />
        </Button>
      )}
    </div>
  )
}
