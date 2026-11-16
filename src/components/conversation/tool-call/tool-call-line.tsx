import {
  BotIcon,
  CircleAlertIcon,
  FileIcon,
  GlobeIcon,
  PencilIcon,
  SquareTerminalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"

import { Approval } from "@/components/conversation/cards/approval"
import { DiffBlock } from "@/components/conversation/tool-call/diff-block"
import { OutputBlock } from "@/components/conversation/tool-call/output-block"
import { ToolDescription } from "@/components/conversation/tool-call/tool-description"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { PermissionItem, ToolCallItem } from "@/lib/agent-api"
import { endPathDrag, startPathDrag } from "@/lib/drag-path"
import { mainInput } from "@/lib/tool-input"
import { VERBS } from "@/lib/tool-verbs"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  Read: FileIcon,
  Edit: PencilIcon,
  Write: PencilIcon,
  Bash: SquareTerminalIcon,
  WebFetch: GlobeIcon,
  Agent: BotIcon,
}

export function ToolCallLine({
  call,
  cwd,
  request,
  agentName,
  onAnswer,
  subagentCalls = [],
  requests,
  anchorId,
}: {
  call: ToolCallItem
  cwd: string
  request: PermissionItem | undefined
  agentName: string
  onAnswer: (requestId: string, answer: RequestAnswer) => Promise<boolean>
  subagentCalls?: ToolCallItem[]
  requests?: Map<string, PermissionItem>
  anchorId?: string
}) {
  const failed = call.status === "error"
  const [opened, setOpened] = useState<boolean | null>(null)
  const childWaits = subagentCalls.some(
    (child) => requests?.get(child.toolUseId)?.status === "pending"
  )
  const open = childWaits || (opened ?? failed)
  const waits = request?.status === "pending" || childWaits
  const running = call.status === "running" && !waits
  const target = mainInput(call.name, call.input, cwd)
  const filePath =
    typeof call.input.file_path === "string" ? call.input.file_path : null
  const { result } = call
  const detail =
    result?.kind === "output"
      ? [result.stdout, result.stderr].filter(Boolean).join("\n")
      : result?.kind === "error"
        ? result.message
        : ""
  const diffLines = result?.kind === "diff" ? (result.lines ?? []) : []
  const Icon = failed ? CircleAlertIcon : (ICONS[call.name] ?? WrenchIcon)
  const verbs = VERBS[call.name]
  const verb = verbs
    ? call.status === "running"
      ? verbs.running
      : failed
        ? verbs.failed
        : verbs.done
    : call.name
  const line = (
    <TraceLine
      status={running ? "running" : failed ? "error" : undefined}
      className={cn(
        failed &&
          "data-[status=error]:text-foreground data-[status=error]:in-[a:hover,button:hover]:text-foreground"
      )}
    >
      <TraceIcon
        className={cn(
          failed && "text-status-error",
          waits && "text-status-waiting"
        )}
      >
        {running ? <Spinner role="img" aria-label="Running" /> : <Icon />}
      </TraceIcon>
      <TraceTitle>
        {verb}{" "}
        <code
          draggable={filePath !== null}
          onDragStart={(event) => filePath && startPathDrag(event, filePath)}
          onDragEnd={endPathDrag}
          className={cn(
            call.name === "Agent"
              ? "font-sans"
              : "font-mono text-[13px] text-link",
            filePath && "cursor-grab"
          )}
        >
          {target}
        </code>
      </TraceTitle>
      <ToolDescription call={call} subagentCount={subagentCalls.length} />
    </TraceLine>
  )
  return (
    <section
      id={anchorId}
      tabIndex={anchorId ? -1 : undefined}
      aria-label={`${call.name} ${target}`}
      className="flex min-w-0 flex-col gap-2"
    >
      {detail || diffLines.length > 0 || subagentCalls.length > 0 ? (
        <TraceCollapsible open={open} onOpenChange={setOpened}>
          <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
          <TraceCollapsibleContent className="flex flex-col gap-2">
            {subagentCalls.length > 0 && (
              <Trace>
                {subagentCalls.map((child) => (
                  <ToolCallLine
                    key={child.toolUseId}
                    call={child}
                    cwd={cwd}
                    request={requests?.get(child.toolUseId)}
                    agentName={agentName}
                    onAnswer={onAnswer}
                  />
                ))}
              </Trace>
            )}
            {diffLines.length > 0 && result?.kind === "diff" && (
              <DiffBlock lines={diffLines} more={result.more ?? 0} />
            )}
            {detail && <OutputBlock text={detail} failed={failed} />}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      ) : (
        line
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
