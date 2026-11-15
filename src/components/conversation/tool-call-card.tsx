import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"

import { Approval } from "@/components/conversation/approval"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { Json, PermissionItem, ToolCallItem } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

const DOT: Record<ToolCallItem["status"], string> = {
  running: "bg-status-working",
  done: "bg-status-online",
  error: "bg-status-error",
  stopped: "bg-status-idle",
}

export function ToolCallCard({
  call,
  cwd,
  request,
  agentName,
  onAnswer,
  subagentCalls = [],
  requests,
  anchorId,
  compact = false,
}: {
  call: ToolCallItem
  cwd: string
  request: PermissionItem | undefined
  agentName: string
  onAnswer: (requestId: string, answer: RequestAnswer) => void
  subagentCalls?: ToolCallItem[]
  requests?: Map<string, PermissionItem>
  anchorId?: string
  compact?: boolean
}) {
  const [opened, setOpened] = useState(false)
  const childWaits = subagentCalls.some(
    (child) => requests?.get(child.toolUseId)?.status === "pending"
  )
  const open = opened || childWaits
  const waits = request?.status === "pending" || childWaits
  const target = mainInput(call.name, call.input, cwd)
  const { result } = call
  const detail =
    result?.kind === "output"
      ? [result.stdout, result.stderr].filter(Boolean).join("\n")
      : result?.kind === "error"
        ? result.message
        : null
  return (
    <section
      id={anchorId}
      tabIndex={anchorId ? -1 : undefined}
      aria-label={`${call.name} ${target}`}
      className={cn(
        "max-w-[640px] overflow-hidden border bg-rail font-mono text-[13px] leading-5",
        compact ? "rounded-[10px]" : "rounded-[14px]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          compact ? "px-2.5 py-1" : "px-3 py-1.5",
          subagentCalls.length > 0 && "pr-1.5"
        )}
      >
        {call.status === "running" && !waits ? (
          <Spinner
            role="img"
            aria-label="Running"
            className="size-3 flex-none text-status-working"
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "size-2 flex-none rounded-full",
              waits ? "bg-status-waiting" : DOT[call.status]
            )}
          />
        )}
        <span className="text-foreground-strong">{call.name}</span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            call.name === "Agent" ? "font-sans text-foreground" : "text-link",
            call.name === "Agent" &&
              call.status === "running" &&
              "shimmer motion-reduce:shimmer-none"
          )}
        >
          {target}
        </span>
        {call.status === "stopped" && (
          <span className="text-muted-foreground">Stopped</span>
        )}
        {result?.kind === "lines" && (
          <span className="text-muted-foreground">{result.count} lines</span>
        )}
        {result?.kind === "diff" && (
          <>
            {result.added > 0 && (
              <span className="text-diff-add">+{result.added}</span>
            )}
            {result.removed > 0 && (
              <span className="text-diff-remove">−{result.removed}</span>
            )}
          </>
        )}
        {subagentCalls.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={open}
            className="font-sans"
            onClick={() => setOpened(!open)}
          >
            {subagentCalls.length === 1
              ? "1 tool call"
              : `${subagentCalls.length} tool calls`}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("transition-transform", open && "rotate-180")}
            />
          </Button>
        )}
      </div>
      {detail && (
        <div
          className={cn(
            "border-t px-3 py-2 whitespace-pre-wrap",
            result?.kind === "error"
              ? "text-diff-remove"
              : "text-muted-foreground"
          )}
        >
          {detail}
        </div>
      )}
      {subagentCalls.length > 0 && open && (
        <div className="flex flex-col gap-1.5 border-t bg-background p-2">
          {subagentCalls.map((child) => (
            <ToolCallCard
              key={child.toolUseId}
              call={child}
              cwd={cwd}
              request={requests?.get(child.toolUseId)}
              agentName={agentName}
              onAnswer={onAnswer}
              compact
            />
          ))}
        </div>
      )}
      {request && (
        <Approval
          request={request}
          label={`${call.name} ${target}`}
          agentName={agentName}
          onAnswer={onAnswer}
        />
      )}
    </section>
  )
}

export function mainInput(name: string, input: Json, cwd: string): string {
  const value =
    input.file_path ??
    input.command ??
    input.pattern ??
    input.url ??
    input.description ??
    ""
  const text = typeof value === "string" ? value : ""
  if (name === "Bash") return text
  const prefix = cwd.endsWith("/") ? cwd : `${cwd}/`
  return text.startsWith(prefix) ? text.slice(prefix.length) : text
}
