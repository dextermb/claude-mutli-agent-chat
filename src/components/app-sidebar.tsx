import {
  HashIcon,
  LockIcon,
  PlusIcon,
  SquarePenIcon,
  UsersIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, useLocation } from "wouter"

import { statusOf } from "@/components/conversation/agent-look"
import { CreateChannelDialog } from "@/components/create-channel-dialog"
import { StartChatDialog } from "@/components/start-chat-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks/use-workspace"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

const ROW =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent"

export function AppSidebar({
  currentId,
  open = false,
  onOpenChange = () => undefined,
}: {
  currentId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { conversations, agents, unread } = useWorkspace()
  const [dialog, setDialog] = useState<"chat" | "channel" | null>(null)
  const [, setLocation] = useLocation()
  const isMobile = useIsMobile()

  function navigate(to: string) {
    onOpenChange(false)
    setLocation(to)
  }

  async function openDirectMessage(agent: AgentWithState) {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "dm", agentId: agent.id }),
    })
    if (!response.ok) return
    const { conversation } = (await response.json()) as {
      conversation: Conversation
    }
    navigate(`/conversations/${conversation.id}`)
  }

  const linkTo = (conversation: Conversation, children: ReactNode) => {
    const isUnread =
      conversation.id !== currentId && (unread[conversation.id] ?? 0) > 0
    return (
      <Link
        href={`/conversations/${conversation.id}`}
        onClick={() => onOpenChange(false)}
        aria-current={conversation.id === currentId ? "page" : undefined}
        className={cn(
          ROW,
          isUnread && "font-semibold text-foreground-strong",
          conversation.id === currentId &&
            "bg-sidebar-accent font-medium text-foreground-strong"
        )}
      >
        {children}
        {isUnread && (
          <>
            {" "}
            <span className="sr-only">unread</span>
          </>
        )}
      </Link>
    )
  }

  const channels = conversations.filter((item) => item.kind === "channel")
  const groups = conversations.filter((item) => item.kind === "group")
  const directMessages = conversations.filter((item) => item.kind === "dm")

  const content = (
    <>
      <div className="flex items-center gap-1 pl-2">
        <Link
          href="/"
          className="flex-1 text-base font-semibold text-foreground-strong"
        >
          Agent Lab
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Start a chat"
          onClick={() => setDialog("chat")}
        >
          <SquarePenIcon />
        </Button>
      </div>
      <StartChatDialog
        open={dialog === "chat"}
        agents={agents}
        onOpenChange={(open) => setDialog(open ? "chat" : null)}
        onStarted={(conversation) => {
          setDialog(null)
          navigate(`/conversations/${conversation.id}`)
        }}
      />
      <CreateChannelDialog
        open={dialog === "channel"}
        agents={agents}
        onOpenChange={(open) => setDialog(open ? "channel" : null)}
        onCreated={(conversation) => {
          setDialog(null)
          navigate(`/conversations/${conversation.id}`)
        }}
      />
      <Section
        title="Channels"
        action={{
          label: "Create a channel",
          onClick: () => setDialog("channel"),
        }}
      >
        {channels.map((channel) => (
          <li key={channel.id}>
            {linkTo(
              channel,
              <>
                {channel.private ? (
                  <LockIcon aria-hidden="true" className="size-4" />
                ) : (
                  <HashIcon aria-hidden="true" className="size-4" />
                )}
                <span className="truncate">{channel.name}</span>
              </>
            )}
          </li>
        ))}
      </Section>
      <Section title="Group chats">
        {groups.map((group) => (
          <li key={group.id}>
            {linkTo(
              group,
              <>
                <UsersIcon aria-hidden="true" className="size-4" />
                <span className="truncate">{group.name}</span>
              </>
            )}
          </li>
        ))}
      </Section>
      <Section
        title="Agents"
        action={{ label: "New agent", href: "/agents/new" }}
      >
        {agents.map((agent) => {
          const status = statusOf(agent.state)
          const label = (
            <>
              <span
                aria-hidden="true"
                className={cn("mx-1 size-2 flex-none rounded-full", status.dot)}
              />
              <span className="truncate">{agent.name}</span>{" "}
              <span className="sr-only">{status.label}</span>
            </>
          )
          const dm = directMessages.find((item) =>
            item.members.includes(`agent:${agent.id}`)
          )
          return (
            <li key={agent.id}>
              {dm ? (
                linkTo(dm, label)
              ) : (
                <button
                  type="button"
                  className={ROW}
                  onClick={() => void openDirectMessage(agent)}
                >
                  {label}
                </button>
              )}
            </li>
          )
        })}
      </Section>
      <WorkFooter agents={agents} />
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Sidebar</SheetTitle>
          <nav
            aria-label="Conversations"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pt-12 pb-3"
          >
            {content}
          </nav>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <nav
      aria-label="Conversations"
      className="flex w-64 flex-none flex-col gap-4 overflow-y-auto border-r bg-sidebar px-2 py-3"
    >
      {content}
    </nav>
  )
}

function WorkFooter({ agents }: { agents: AgentWithState[] }) {
  const working = agents.filter((agent) => agent.state === "busy").length
  const waiting = agents.filter((agent) => agent.state === "waiting").length
  const parts = [
    working > 0 && `${working} ${working === 1 ? "agent" : "agents"} working`,
    waiting > 0 && `${waiting} needs approval`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="m-0 mt-auto flex items-center gap-2 px-2 text-xs text-sidebar-foreground/70">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 flex-none rounded-full",
          statusOf(working > 0 ? "busy" : "waiting").dot
        )}
      />
      {parts.join(" · ")}
    </p>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?:
    { label: string; href: string } | { label: string; onClick: () => void }
  children: ReactNode
}) {
  const actionClass =
    "rounded p-0.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2">
        <h2 className="m-0 text-xs font-medium text-sidebar-foreground/70">
          {title}
        </h2>
        {action && "href" in action && (
          <Link
            href={action.href}
            aria-label={action.label}
            className={actionClass}
          >
            <PlusIcon className="size-4" />
          </Link>
        )}
        {action && "onClick" in action && (
          <button
            type="button"
            aria-label={action.label}
            className={actionClass}
            onClick={action.onClick}
          >
            <PlusIcon className="size-4" />
          </button>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
    </section>
  )
}
