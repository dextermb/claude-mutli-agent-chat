import { Approval } from "@/components/conversation/approval"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { Json, PermissionItem, ToolCallItem } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

const DOT: Record<ToolCallItem["status"], string> = {
  running: "bg-status-working",
  done: "bg-status-online",
  error: "bg-status-error",
}

export function ToolCallCard({
  call,
  cwd,
  request,
  agentName,
  onAnswer,
}: {
  call: ToolCallItem
  cwd: string
  request: PermissionItem | undefined
  agentName: string
  onAnswer: (requestId: string, answer: RequestAnswer) => void
}) {
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
      aria-label={`${call.name} ${target}`}
      className="max-w-[640px] overflow-hidden rounded-[14px] border bg-rail font-mono text-[13px] leading-5"
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className={cn(
            "size-2 flex-none rounded-full",
            request?.status === "pending"
              ? "bg-status-waiting"
              : DOT[call.status]
          )}
        />
        <span className="text-foreground-strong">{call.name}</span>
        <span className="min-w-0 flex-1 truncate text-link">{target}</span>
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
    input.file_path ?? input.command ?? input.pattern ?? input.url ?? ""
  const text = typeof value === "string" ? value : ""
  if (name === "Bash") return text
  const prefix = cwd.endsWith("/") ? cwd : `${cwd}/`
  return text.startsWith(prefix) ? text.slice(prefix.length) : text
}
