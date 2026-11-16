import {
  BotIcon,
  ChevronDownIcon,
  HashIcon,
  HouseIcon,
  LockIcon,
  PlusIcon,
  SquarePenIcon,
  UsersIcon,
} from "lucide-react"
import { Fragment, useState, type ReactNode } from "react"
import { Link, useLocation } from "wouter"

import { HUMAN_AVATAR, statusOf } from "@/components/conversation/agent-look"
import { CreateChannelDialog } from "@/components/dialogs/create-channel-dialog"
import { StartChatDialog } from "@/components/dialogs/start-chat-dialog"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks/use-workspace"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

const ROW =
  "data-active:bg-sidebar-primary data-active:font-medium data-active:text-sidebar-primary-foreground"

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
  const [location, setLocation] = useLocation()
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

  const row = (conversation: Conversation, children: ReactNode) => {
    const isCurrent = conversation.id === currentId
    const count = isCurrent ? 0 : (unread[conversation.id] ?? 0)
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isCurrent}
          className={cn(
            ROW,
            count > 0 && "font-semibold text-foreground-strong"
          )}
          render={
            <Link
              href={`/conversations/${conversation.id}`}
              onClick={() => onOpenChange(false)}
              aria-current={isCurrent ? "page" : undefined}
            />
          }
        >
          {children}
          {count > 0 && (
            <>
              {" "}
              <span className="sr-only">{`${count} unread`}</span>
            </>
          )}
        </SidebarMenuButton>
        {count > 0 && (
          <SidebarMenuBadge
            aria-hidden="true"
            className="bg-mention text-primary-foreground peer-hover/menu-button:text-primary-foreground"
          >
            {count}
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    )
  }

  const channels = conversations.filter((item) => item.kind === "channel")
  const groups = conversations.filter((item) => item.kind === "group")
  const directMessages = conversations.filter((item) => item.kind === "dm")

  const sidebar = (
    <div className="flex h-full">
      <WorkspaceRail onAgents={location.startsWith("/agents")} />
      <SidebarProvider className="min-h-0 w-auto">
        <Sidebar collapsible="none" className="w-64">
          <nav
            aria-label="Conversations"
            className="flex min-h-0 flex-1 flex-col"
          >
            <SidebarHeader>
              <div className="flex items-center gap-1 py-1 pr-1 pl-2">
                <Link
                  href="/"
                  onClick={() => onOpenChange(false)}
                  className="text-base font-semibold text-foreground-strong"
                >
                  Agent Lab
                </Link>
                <ChevronDownIcon aria-hidden="true" className="size-3.5" />
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Start a chat"
                  onClick={() => setDialog("chat")}
                >
                  <SquarePenIcon />
                </Button>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <Group
                title="Channels"
                action={{
                  label: "Create a channel",
                  onClick: () => setDialog("channel"),
                }}
              >
                {channels.map((channel) => (
                  <Fragment key={channel.id}>
                    {row(
                      channel,
                      <>
                        {channel.private ? (
                          <LockIcon aria-hidden="true" />
                        ) : (
                          <HashIcon aria-hidden="true" />
                        )}
                        <span>{channel.name}</span>
                      </>
                    )}
                  </Fragment>
                ))}
              </Group>
              <Group
                title="Group chats"
                action={{
                  label: "Start a group chat",
                  onClick: () => setDialog("chat"),
                }}
              >
                {groups.map((group) => (
                  <Fragment key={group.id}>
                    {row(
                      group,
                      <>
                        <UsersIcon aria-hidden="true" />
                        <span>{group.name}</span>
                      </>
                    )}
                  </Fragment>
                ))}
              </Group>
              <Group
                title="Agents"
                action={{
                  label: "New agent",
                  href: "/agents/new",
                  onClick: () => onOpenChange(false),
                }}
              >
                {agents.map((agent) => {
                  const status = statusOf(agent.state)
                  const label = (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mx-1 size-2 flex-none rounded-full",
                          status.dot
                        )}
                      />
                      <span>{agent.name}</span>{" "}
                      <span className="sr-only">{status.label}</span>
                    </>
                  )
                  const dm = directMessages.find((item) =>
                    item.members.includes(`agent:${agent.id}`)
                  )
                  return (
                    <Fragment key={agent.id}>
                      {dm ? (
                        row(dm, label)
                      ) : (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            className={ROW}
                            onClick={() => void openDirectMessage(agent)}
                          >
                            {label}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </Fragment>
                  )
                })}
              </Group>
            </SidebarContent>
            <SidebarFooter>
              <WorkFooter agents={agents} />
            </SidebarFooter>
          </nav>
        </Sidebar>
      </SidebarProvider>
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
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="w-80 max-w-[85vw] gap-0 bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Sidebar</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
    )
  }

  return <div className="flex h-svh flex-none border-r">{sidebar}</div>
}

function WorkspaceRail({ onAgents }: { onAgents: boolean }) {
  return (
    <nav
      aria-label="Workspace"
      className="flex w-16 flex-none flex-col items-center gap-2 bg-rail py-3"
    >
      <div
        aria-hidden="true"
        className="mb-2 grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
      >
        AL
      </div>
      <Link
        href="/"
        aria-label="Home"
        className={buttonVariants({
          variant: onAgents ? "ghost" : "secondary",
          size: "icon",
        })}
      >
        <HouseIcon />
      </Link>
      <Link
        href="/"
        aria-label="Agents"
        className={buttonVariants({
          variant: onAgents ? "secondary" : "ghost",
          size: "icon",
        })}
      >
        <BotIcon />
      </Link>
      <div className="flex-1" />
      <Avatar role="img" aria-label="You, online">
        <AvatarFallback className={HUMAN_AVATAR}>Y</AvatarFallback>
        <AvatarBadge className="bg-status-online" />
      </Avatar>
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
    <p className="m-0 flex items-center gap-2 px-2 py-1 text-xs text-foreground-faint">
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

function Group({
  title,
  action,
  children,
}: {
  title: string
  action:
    | { label: string; href: string; onClick: () => void }
    | { label: string; onClick: () => void }
  children: ReactNode
}) {
  return (
    <SidebarGroup aria-label={title} role="group">
      <SidebarGroupLabel render={<h2 />} className="m-0">
        {title}
      </SidebarGroupLabel>
      <SidebarGroupAction
        aria-label={action.label}
        onClick={action.onClick}
        render={"href" in action ? <Link href={action.href} /> : undefined}
      >
        <PlusIcon />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
