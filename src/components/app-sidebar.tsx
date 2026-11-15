import { HashIcon, LockIcon, PlusIcon, UsersIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link, useLocation } from "wouter"

import { statusOf } from "@/components/conversation/agent-look"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

const ROW =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent"

export function AppSidebar({ currentId }: { currentId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [agents, setAgents] = useState<AgentWithState[]>([])
  const [, navigate] = useLocation()

  useEffect(() => {
    let current = true
    Promise.all([
      fetch("/api/conversations").then(
        (response) =>
          response.json() as Promise<{ conversations: Conversation[] }>
      ),
      fetch("/api/agents").then(
        (response) => response.json() as Promise<{ agents: AgentWithState[] }>
      ),
    ])
      .then(([listed, team]) => {
        if (!current) return
        setConversations(listed.conversations)
        setAgents(team.agents)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [currentId])

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

  const linkTo = (conversation: Conversation, children: ReactNode) => (
    <Link
      href={`/conversations/${conversation.id}`}
      aria-current={conversation.id === currentId ? "page" : undefined}
      className={cn(
        ROW,
        conversation.id === currentId &&
          "bg-sidebar-accent font-medium text-foreground-strong"
      )}
    >
      {children}
    </Link>
  )

  const channels = conversations.filter((item) => item.kind === "channel")
  const groups = conversations.filter((item) => item.kind === "group")
  const directMessages = conversations.filter((item) => item.kind === "dm")

  return (
    <nav
      aria-label="Conversations"
      className="flex w-64 flex-none flex-col gap-4 overflow-y-auto border-r bg-sidebar px-2 py-3"
    >
      <Link
        href="/"
        className="px-2 text-base font-semibold text-foreground-strong"
      >
        Agent Lab
      </Link>
      <Section title="Channels">
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
    </nav>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: { label: string; href: string }
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2">
        <h2 className="m-0 text-xs font-medium text-sidebar-foreground/70">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            aria-label={action.label}
            className="rounded p-0.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            <PlusIcon className="size-4" />
          </Link>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
    </section>
  )
}
