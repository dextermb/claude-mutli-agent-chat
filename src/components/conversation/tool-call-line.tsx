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

import { Approval } from "@/components/conversation/approval"
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockFooter,
  CodeBlockLine,
} from "@/components/ui/code-block"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type {
  DiffLine,
  Json,
  PermissionItem,
  ToolCallItem,
} from "@/lib/agent-api"
import { endPathDrag, startPathDrag } from "@/lib/drag-path"
import { cn } from "@/lib/utils"

const VERBS: Record<string, { running: string; done: string; failed: string }> =
  {
    Read: { running: "Reading", done: "Read", failed: "Failed to read" },
    Edit: { running: "Editing", done: "Edited", failed: "Failed to edit" },
    Write: { running: "Writing", done: "Wrote", failed: "Failed to write" },
    Bash: { running: "Running", done: "Ran", failed: "Failed to run" },
    WebFetch: {
      running: "Fetching",
      done: "Fetched",
      failed: "Failed to fetch",
    },
    Agent: {
      running: "Running the subagent:",
      done: "Ran the subagent:",
      failed: "The subagent failed:",
    },
  }

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
      <Description call={call} subagentCount={subagentCalls.length} />
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

function Description({
  call,
  subagentCount,
}: {
  call: ToolCallItem
  subagentCount: number
}) {
  const { result } = call
  const parts = [
    call.status === "stopped" && "Stopped",
    result?.kind === "lines" && `${result.count} lines`,
    result?.kind === "diff" &&
      [
        result.added > 0 && `+${result.added}`,
        result.removed > 0 && `−${result.removed}`,
      ]
        .filter(Boolean)
        .join(" "),
    subagentCount === 1 && "1 tool call",
    subagentCount > 1 && `${subagentCount} tool calls`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <TraceDescription
      className={cn(
        "text-foreground-faint",
        result?.kind === "diff" && "font-mono"
      )}
    >
      {parts.join(" · ")}
    </TraceDescription>
  )
}

const LINE_VARIANT = {
  add: "added",
  remove: "removed",
  same: "default",
} as const

function DiffBlock({ lines, more }: { lines: DiffLine[]; more: number }) {
  return (
    <CodeBlock size="sm">
      <CodeBlockContent className="max-h-64">
        {lines.map((line, index) => (
          <CodeBlockLine key={index} variant={LINE_VARIANT[line.kind]}>
            {line.text}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
      {more > 0 && (
        <CodeBlockFooter className="text-xs text-foreground-faint">
          {more} more lines
        </CodeBlockFooter>
      )}
    </CodeBlock>
  )
}

export function OutputBlock({
  text,
  failed,
}: {
  text: string
  failed: boolean
}) {
  return (
    <CodeBlock
      size="sm"
      className={cn(
        failed && "border-transparent bg-error-soft text-foreground"
      )}
    >
      <CodeBlockContent wrap className="max-h-64">
        {text}
      </CodeBlockContent>
    </CodeBlock>
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
