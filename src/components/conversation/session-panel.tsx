import { CopyIcon, RotateCcwIcon, SquareIcon, XIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RefusalAlert } from "@/components/conversation/refusal-alert"
import type { SessionCard } from "@/lib/agent-api"

export function SessionPanel({
  label,
  card,
  agentName,
  working,
  onStopTurn,
  onNewSession,
  onClose,
  onRemove,
}: {
  label: string
  card: SessionCard | null
  agentName: string
  working: boolean
  onStopTurn: () => Promise<string | null>
  onNewSession: () => Promise<string | null>
  onClose?: () => void
  onRemove?: () => Promise<string | null>
}) {
  const [asking, setAsking] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  return (
    <aside
      aria-label={label}
      className="flex w-[340px] flex-none flex-col gap-3 overflow-y-auto border-l p-4"
    >
      {onClose && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          className="self-end"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      )}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>One headless Claude Code process.</CardDescription>
        </CardHeader>
        <CardContent>
          {card && (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <Row term="Model" value={card.model} />
              <Row term="Permissions" value={card.permissionMode} />
              <Row term="Directory" value={card.directory} />
              <Row
                term="Session ID"
                value={card.claudeSessionId?.slice(0, 8) ?? "None yet"}
                action={
                  card.claudeSessionId && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Copy session ID"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          card.claudeSessionId ?? ""
                        )
                      }}
                    >
                      <CopyIcon />
                    </Button>
                  )
                }
              />
              <Row term="Turns" value={String(card.turns)} />
              <Row term="Cost" value={formatCost(card.costUsd)} />
            </dl>
          )}
          {card?.configChanged && (
            <p className="m-0 mt-3 text-[13px] text-status-working">
              The configuration changed. Start a new session to use it.
            </p>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          {working && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => setRefusal(await onStopTurn())}
            >
              <SquareIcon />
              Stop turn
            </Button>
          )}
          <AlertDialog open={asking} onOpenChange={setAsking}>
            <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
              <RotateCcwIcon />
              New session
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new session?</AlertDialogTitle>
                <AlertDialogDescription>
                  {`${agentName} forgets this conversation. The messages stay here.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setAsking(false)
                    setRefusal(await onNewSession())
                  }}
                >
                  Start new session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
      {card && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Allowed tools</CardTitle>
            <CardDescription>
              Other tools wait for your approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {card.allowedTools.map((tool) => (
              <Badge key={tool} variant="outline" className="font-mono">
                {tool}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      {refusal && (
        <RefusalAlert refusal={refusal} onClose={() => setRefusal(null)} />
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-destructive"
          onClick={async () => setRefusal(await onRemove())}
        >
          Remove from conversation
        </Button>
      )}
    </aside>
  )
}

function Row({
  term,
  value,
  action,
}: {
  term: string
  value: string
  action?: ReactNode
}) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-1 font-mono text-foreground-strong">
        <span className="truncate">{value}</span>
        {action}
      </dd>
    </>
  )
}

function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(costUsd >= 0.01 ? 2 : 3)}`
}
