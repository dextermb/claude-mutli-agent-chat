import {
  ChevronDownIcon,
  CopyIcon,
  InfoIcon,
  RotateCcwIcon,
  SquareIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"

import {
  AVATAR_COLOURS,
  HUMAN_AVATAR,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { RefusalAlert } from "@/components/conversation/refusal-alert"
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
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
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
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AgentWithState, SessionCard } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

type Refusal = { title: string; reason: string } | null

export type SessionDetailsProps = {
  card: SessionCard | null
  agentName: string
  working: boolean
  onStopTurn: () => Promise<string | null>
  onNewSession: () => Promise<string | null>
  onRemove?: () => Promise<string | null>
}

export function SessionPanel(details: SessionDetailsProps) {
  const [refusal, setRefusal] = useState<Refusal>(null)
  return (
    <aside
      aria-label="Session"
      className="flex w-[340px] flex-none flex-col gap-4 overflow-y-auto border-l p-4"
    >
      <h2 className="m-0 px-1 text-sm font-semibold text-foreground-strong">
        Session
      </h2>
      <RefusalOf refusal={refusal} onClose={() => setRefusal(null)} />
      <Card size="sm">
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>One headless Claude Code process.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SessionFacts card={details.card} withModel />
        </CardContent>
        <CardFooter>
          <SessionActions {...details} onRefusal={setRefusal} />
        </CardFooter>
      </Card>
      {details.card && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Allowed tools</CardTitle>
            <CardDescription>
              Other tools wait for your approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllowedTools tools={details.card.allowedTools} />
          </CardContent>
        </Card>
      )}
    </aside>
  )
}

export function SessionSheet({
  open,
  onOpenChange,
  ...details
}: SessionDetailsProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [refusal, setRefusal] = useState<Refusal>(null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80 max-w-[85vw] gap-0 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Session</SheetTitle>
          <SheetDescription>One headless Claude Code process.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <RefusalOf refusal={refusal} onClose={() => setRefusal(null)} />
          <SessionFacts card={details.card} withModel />
          <SessionActions {...details} onRefusal={setRefusal} />
          {details.card && (
            <>
              <Separator />
              <h3 className="m-0 text-sm font-semibold text-foreground-strong">
                Allowed tools
              </h3>
              <AllowedTools tools={details.card.allowedTools} />
              <p className="m-0 text-xs text-foreground-faint">
                Other tools wait for your approval.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MembersPanel({
  asSheet,
  open,
  onClose,
  people,
  agents,
  pickedId,
  onPick,
  details,
  addLabel,
  onAdd,
}: {
  asSheet: boolean
  open: boolean
  onClose: () => void
  people: number
  agents: AgentWithState[]
  pickedId: string | null
  onPick: (agentId: string | null) => void
  details: SessionDetailsProps | null
  addLabel: string
  onAdd: () => void
}) {
  const count = `${people} ${people === 1 ? "person" : "people"} · ${
    agents.length
  } ${agents.length === 1 ? "agent" : "agents"}`
  const body = (
    <>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 rounded-[10px] p-2">
          <Avatar size="sm" aria-hidden="true">
            <AvatarFallback className={HUMAN_AVATAR}>Y</AvatarFallback>
          </Avatar>
          <span className="flex-1 font-medium text-foreground-strong">You</span>
        </div>
        {agents.map((agent) => {
          const status = statusOf(agent.state)
          const isOpen = agent.id === pickedId
          return (
            <div
              key={agent.id}
              className={cn("rounded-[10px]", isOpen && "bg-card")}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={`${agent.name} ${status.label}`}
                className="flex w-full items-center gap-2.5 rounded-[10px] p-2 text-left hover:bg-muted"
                onClick={() => onPick(isOpen ? null : agent.id)}
              >
                <Avatar size="sm" aria-hidden="true">
                  <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                    {initialsOf(agent.name)}
                  </AvatarFallback>
                  <AvatarBadge className={status.dot} />
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground-strong">
                    {agent.name}
                  </span>
                  <span className="truncate font-mono text-xs text-foreground-faint">
                    {agent.model}
                  </span>
                </span>
                <Badge variant="outline" className={status.text}>
                  {status.label}
                </Badge>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 text-foreground-faint transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && details && (
                <MemberSession key={agent.id} {...details} />
              )}
            </div>
          )
        })}
      </div>
      <Button variant="outline" className="self-start" onClick={onAdd}>
        <UserPlusIcon />
        {addLabel}
      </Button>
    </>
  )
  const note = (
    <p className="m-0 px-1 text-xs leading-[18px] text-foreground-faint">
      All members read and write this one thread. Each agent runs its own Claude
      Code process.
    </p>
  )

  if (asSheet) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent
          side="right"
          className="w-80 max-w-[85vw] gap-0 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Members</SheetTitle>
            <SheetDescription>{count}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-3 pb-4">
            {note}
            {body}
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  if (!open) return null
  return (
    <aside
      aria-label="Members"
      className="flex w-[360px] flex-none flex-col gap-3 overflow-y-auto border-l px-3 py-4"
    >
      <div className="flex min-h-8 items-center gap-2 px-1">
        <h2 className="m-0 flex-1 text-sm font-semibold text-foreground-strong">
          Members
        </h2>
        <span className="text-xs text-foreground-faint">{count}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      {note}
      {body}
    </aside>
  )
}

function MemberSession(details: SessionDetailsProps) {
  const [refusal, setRefusal] = useState<Refusal>(null)
  return (
    <section
      aria-label={`Session of ${details.agentName}`}
      className="flex flex-col gap-3 px-3 pt-1 pb-3"
    >
      <RefusalOf refusal={refusal} onClose={() => setRefusal(null)} />
      <SessionFacts card={details.card} />
      <SessionActions {...details} onRefusal={setRefusal} />
    </section>
  )
}

function RefusalOf({
  refusal,
  onClose,
}: {
  refusal: Refusal
  onClose: () => void
}) {
  if (!refusal) return null
  return (
    <RefusalAlert
      title={refusal.title}
      refusal={refusal.reason}
      onClose={onClose}
    />
  )
}

function SessionFacts({
  card,
  withModel = false,
}: {
  card: SessionCard | null
  withModel?: boolean
}) {
  if (!card) return null
  return (
    <>
      {card.configChanged && (
        <p className="m-0 flex items-start gap-2 rounded-[10px] bg-mention-soft px-2.5 py-2 text-[13px] leading-5 text-foreground-strong">
          <InfoIcon
            aria-hidden="true"
            className="mt-0.5 size-4 flex-none text-mention"
          />
          The configuration changed. Start a new session to use it.
        </p>
      )}
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-[13px]">
        {withModel && <Row term="Model" value={card.model} mono />}
        <Row term="Permissions" value={card.permissionMode} mono />
        <Row term="Directory" value={card.directory} mono />
        <Row
          term="Session ID"
          value={card.claudeSessionId?.slice(0, 8) ?? "None yet"}
          mono
          action={
            card.claudeSessionId && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy session ID"
                onClick={() => {
                  void navigator.clipboard.writeText(card.claudeSessionId ?? "")
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
    </>
  )
}

function SessionActions({
  agentName,
  working,
  onStopTurn,
  onNewSession,
  onRemove,
  onRefusal,
}: SessionDetailsProps & { onRefusal: (refusal: Refusal) => void }) {
  const [asking, setAsking] = useState(false)
  async function act(title: string, action: () => Promise<string | null>) {
    const reason = await action()
    onRefusal(reason === null ? null : { title, reason })
  }
  return (
    <div className="flex flex-wrap gap-2">
      {working && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void act("Stop turn did not work.", onStopTurn)}
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
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new session?</AlertDialogTitle>
            <AlertDialogDescription>
              {`${agentName} forgets this conversation. The messages stay here.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="m-0 flex flex-col gap-1 pl-[18px] text-[13px] leading-5 text-muted-foreground">
            <li>
              {`The turn that runs now stops. A message that waits for ${agentName} does not get a reply.`}
            </li>
            <li>{`The new process uses the current configuration of ${agentName}.`}</li>
            <li>A divider marks the new session in the timeline.</li>
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAsking(false)
                void act("New session did not work.", onNewSession)
              }}
            >
              <RotateCcwIcon />
              Start new session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void act("Remove did not work.", onRemove)}
        >
          <Trash2Icon />
          Remove
        </Button>
      )}
    </div>
  )
}

function AllowedTools({ tools }: { tools: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <Badge key={tool} variant="secondary" className="font-mono">
          {tool}
        </Badge>
      ))}
    </div>
  )
}

function Row({
  term,
  value,
  mono = false,
  action,
}: {
  term: string
  value: string
  mono?: boolean
  action?: ReactNode
}) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd
        className={cn(
          "m-0 flex min-w-0 items-center gap-1",
          mono ? "font-mono" : "tabular-nums"
        )}
      >
        <span className="truncate">{value}</span>
        {action}
      </dd>
    </>
  )
}

function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(costUsd >= 0.01 ? 2 : 3)}`
}
