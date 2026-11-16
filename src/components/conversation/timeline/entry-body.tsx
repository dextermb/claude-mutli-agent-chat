import { CopyIcon, TriangleAlertIcon } from "lucide-react"

import { QuestionCard } from "@/components/conversation/cards/question-card"
import { MessageFiles } from "@/components/conversation/files/message-files"
import { FailedNotice } from "@/components/conversation/timeline/failed-notice"
import { MessageText } from "@/components/conversation/timeline/message-text"
import { ToolCallLine } from "@/components/conversation/tool-call/tool-call-line"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import type {
  ConversationAgent,
  PermissionItem,
  TimelineEntry,
  ToolCallItem,
} from "@/lib/agent-api"
import { clockTime, dayKey, longDay } from "@/lib/time"
import { entryAnchor, type Answer } from "@/lib/timeline"
import { cn } from "@/lib/utils"

export function EntryBody({
  entry,
  agent,
  agents,
  requests,
  subagentCalls,
  onAnswer,
}: {
  entry: TimelineEntry
  agent: ConversationAgent | undefined
  agents: ConversationAgent[]
  requests: Map<string, PermissionItem>
  subagentCalls: Map<string, ToolCallItem[]>
  onAnswer: Answer
}) {
  const { item } = entry
  if (item.kind === "tool_call") {
    return (
      <ToolCallLine
        call={item}
        cwd={agent?.sessionCwd ?? ""}
        request={requests.get(item.toolUseId)}
        agentName={agent?.name ?? "the agent"}
        onAnswer={onAnswer}
        subagentCalls={subagentCalls.get(item.toolUseId)}
        requests={requests}
        anchorId={entryAnchor(entry.id)}
      />
    )
  }
  if (item.kind === "question") {
    return <QuestionCard card={item} onAnswer={onAnswer} />
  }
  if (item.kind === "turn") {
    const seconds = `${(item.durationMs / 1000).toFixed(1)} s`
    const spent = `$${item.costUsd.toFixed(3)} · ${item.numTurns} turns`
    return (
      <p className="m-0 text-xs text-foreground-faint">
        {item.status === "stopped" && `Stopped after ${seconds}`}
        {item.status === "limit" &&
          `Stopped at the turn limit after ${seconds} · ${spent}. Send a message to continue.`}
        {item.status === "done" && `Done in ${seconds} · ${spent}`}
      </p>
    )
  }
  if (item.kind === "notice" && item.reason === "failed") {
    return (
      <FailedNotice
        agentName={agent?.name ?? "The agent"}
        exitCode={item.exitCode}
        stderr={item.stderr}
      />
    )
  }
  if (item.kind === "notice" && item.reason === "rate_limit") {
    const limit = item.rateLimitType.replaceAll("_", "-")
    const resetsAt = new Date(item.resetsAt * 1000).toISOString()
    const resets =
      dayKey(resetsAt) === new Date().toDateString()
        ? `at ${clockTime(resetsAt)}`
        : `on ${longDay(resetsAt)} at ${clockTime(resetsAt)}`
    return (
      <p
        className={cn(
          "m-0 flex items-center gap-2 text-[13px]",
          item.status === "rejected"
            ? "text-status-error"
            : "text-status-working"
        )}
      >
        <TriangleAlertIcon aria-hidden="true" className="size-4 flex-none" />
        {`The ${limit} rate limit is ${
          item.status === "rejected" ? "reached" : "near"
        }. It resets ${resets}.`}
      </p>
    )
  }
  if (item.kind === "message") {
    const text = item.text && (
      <p
        aria-busy={item.status === "streaming"}
        className={cn(
          "m-0 leading-[22px] whitespace-pre-wrap",
          item.status === "streaming" &&
            "after:ml-0.5 after:animate-pulse after:text-muted-foreground after:content-['▍'] motion-reduce:after:animate-none"
        )}
      >
        <MessageText text={item.text} agents={agents} />
      </p>
    )
    return (
      <>
        {text &&
          (agent ? (
            <div className="flex flex-col items-start gap-1">
              {text}
              {item.status === "done" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Copy the message"
                  className="-ml-1.5 text-muted-foreground"
                  onClick={() => {
                    void navigator.clipboard.writeText(item.text)
                  }}
                >
                  <CopyIcon />
                </Button>
              )}
            </div>
          ) : (
            <Bubble variant="muted" align="end">
              <BubbleContent>{text}</BubbleContent>
            </Bubble>
          ))}
        {item.files && item.files.length > 0 && (
          <MessageFiles files={item.files} afterSeq={entry.seq} />
        )}
      </>
    )
  }
  return null
}
