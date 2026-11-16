import { TriangleAlertIcon } from "lucide-react"
import { useState } from "react"

import { OutputBlock } from "@/components/conversation/tool-call/tool-call-line"

export function FailedNotice({
  agentName,
  exitCode,
  stderr,
}: {
  agentName: string
  exitCode: number | null
  stderr: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5 text-[13px] text-status-error">
      <p className="m-0 flex items-center gap-2">
        <TriangleAlertIcon aria-hidden="true" className="size-4 flex-none" />
        {exitCode === null
          ? `${agentName} stopped with an error.`
          : `${agentName} stopped with an error (exit code ${exitCode}).`}
        {stderr !== "" && (
          <button
            type="button"
            aria-expanded={open}
            className="text-muted-foreground underline hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide details" : "Show details"}
          </button>
        )}
      </p>
      {open && (
        <div className="max-w-[640px]">
          <OutputBlock text={stderr} failed />
        </div>
      )}
    </div>
  )
}
