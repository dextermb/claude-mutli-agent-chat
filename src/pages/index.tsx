import {
  BotIcon,
  MenuIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"
import { useState } from "react"
import { Link, useLocation } from "wouter"

import { AppSidebar } from "@/components/sidebar/app-sidebar"
import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks/use-workspace"
import type { AgentWithState, Conversation } from "@/lib/agent-api"

export default function AgentsPage() {
  const { agents, loaded } = useWorkspace()
  const [search, setSearch] = useState("")
  const [, navigate] = useLocation()
  const [showingSidebar, setShowingSidebar] = useState(false)
  const isMobile = useIsMobile()

  async function message(agent: AgentWithState) {
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

  const shown = agents.filter((agent) =>
    agent.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div className="flex h-svh bg-background text-sm text-foreground">
      <AppSidebar
        currentId=""
        open={showingSidebar}
        onOpenChange={setShowingSidebar}
      />
      <main className="flex min-w-0 flex-1 justify-center overflow-y-auto px-6 py-8">
        <div className="flex w-full max-w-[880px] flex-col gap-5">
          <header className="flex flex-wrap items-center gap-4">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open the sidebar"
                onClick={() => setShowingSidebar(true)}
              >
                <MenuIcon />
              </Button>
            )}
            <div className="flex min-w-60 flex-1 flex-col gap-1">
              <h1 className="m-0 text-xl font-semibold text-foreground-strong">
                Agents
              </h1>
              <p className="m-0 text-muted-foreground">
                Each agent is a headless Claude Code process. Message an agent
                to open its DM.
              </p>
            </div>
            <NewAgentButton />
          </header>
          {!loaded && (
            <p className="m-0 text-muted-foreground">Loading the agents.</p>
          )}
          {loaded && agents.length === 0 && <NoAgents />}
          {agents.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <InputGroup className="min-w-56 flex-1">
                  <InputGroupAddon>
                    <SearchIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Search agents"
                    aria-label="Search agents"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </InputGroup>
                <span className="text-xs text-foreground-faint">
                  {summaryOf(agents)}
                </span>
              </div>
              <ItemGroup aria-label="Agents" className="gap-2">
                {shown.map((agent) => {
                  const status = statusOf(agent.state)
                  return (
                    <Item
                      key={agent.id}
                      role="listitem"
                      aria-label={agent.name}
                      variant="outline"
                    >
                      <ItemMedia>
                        <Avatar>
                          <AvatarFallback
                            className={AVATAR_COLOURS[agent.colour]}
                          >
                            {initialsOf(agent.name)}
                          </AvatarFallback>
                          <AvatarBadge className={status.dot} />
                        </Avatar>
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ItemTitle className="text-foreground-strong">
                            {agent.name}
                          </ItemTitle>
                          <Badge variant="outline" className={status.text}>
                            {status.label}
                          </Badge>
                        </div>
                        <ItemDescription className="truncate font-mono text-[13px]">
                          {agent.model} · {agent.cwd ?? "No folder"}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
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
                      </ItemActions>
                    </Item>
                  )
                })}
              </ItemGroup>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function NewAgentButton() {
  return (
    <Button nativeButton={false} render={<Link href="/agents/new" />}>
      <PlusIcon />
      New agent
    </Button>
  )
}

function NoAgents() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-[14px] bg-muted text-muted-foreground"
      >
        <BotIcon className="size-6" />
      </div>
      <h2 className="m-0 text-base font-semibold text-foreground-strong">
        There are no agents.
      </h2>
      <p className="m-0 max-w-[400px] leading-[22px] text-muted-foreground">
        Make an agent. Then message it in a DM, or invite it to a channel.
      </p>
      <NewAgentButton />
    </div>
  )
}

function summaryOf(agents: AgentWithState[]): string {
  const count = (state: AgentWithState["state"]) =>
    agents.filter((agent) => agent.state === state).length
  const parts = [
    `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`,
    count("busy") > 0 && `${count("busy")} working`,
    count("waiting") > 0 && `${count("waiting")} needs approval`,
    count("failed") > 0 && `${count("failed")} error`,
  ]
  return parts.filter(Boolean).join(" · ")
}
