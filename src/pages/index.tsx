import { MessageSquareIcon, PlusIcon, SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useLocation } from "wouter"

import { AppSidebar } from "@/components/app-sidebar"
import {
  AVATAR_COLOURS,
  initialsOf,
} from "@/components/conversation/agent-look"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Agent, Conversation } from "@/lib/agent-api"

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [, navigate] = useLocation()

  useEffect(() => {
    let current = true
    fetch("/api/agents")
      .then((response) => response.json() as Promise<{ agents: Agent[] }>)
      .then((body) => {
        if (current) setAgents(body.agents)
      })
      .catch(() => {
        if (current) setAgents([])
      })
    return () => {
      current = false
    }
  }, [])

  async function message(agent: Agent) {
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

  return (
    <div className="flex h-svh bg-background text-sm text-foreground">
      <AppSidebar currentId="" />
      <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 overflow-y-auto px-6 py-8">
        <header className="flex items-center gap-4">
          <h1 className="m-0 flex-1 text-xl font-semibold text-foreground-strong">
            Agents
          </h1>
          <Button nativeButton={false} render={<Link href="/agents/new" />}>
            <PlusIcon />
            New agent
          </Button>
        </header>
        {agents === null && (
          <p className="text-muted-foreground">Loading the agents.</p>
        )}
        {agents?.length === 0 && (
          <p className="text-muted-foreground">
            There are no agents. Make one with New agent.
          </p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {agents?.map((agent) => (
            <li
              key={agent.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
            >
              <Avatar>
                <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                  {initialsOf(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-foreground-strong">
                  {agent.name}
                </span>
                <span className="truncate font-mono text-xs text-foreground-faint">
                  {agent.model} · {agent.cwd}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void message(agent)}
              >
                <MessageSquareIcon />
                Message
              </Button>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={`/agents/${agent.id}`} />}
              >
                <SettingsIcon />
                Configure
              </Button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
