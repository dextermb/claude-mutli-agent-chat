import {
  ChevronDownIcon,
  HashIcon,
  LockIcon,
  SquarePenIcon,
  UsersIcon,
} from "lucide-react"
import { useState } from "react"
import { Link, useLocation } from "wouter"

import { CreateChannelDialog } from "@/components/dialogs/create-channel-dialog"
import { DeleteDialog } from "@/components/dialogs/delete-dialog"
import { StartChatDialog } from "@/components/dialogs/start-chat-dialog"
import { AgentRow } from "@/components/sidebar/agent-row"
import { ConversationRow } from "@/components/sidebar/conversation-row"
import { SidebarSection } from "@/components/sidebar/sidebar-section"
import { WorkFooter } from "@/components/sidebar/work-footer"
import { WorkspaceRail } from "@/components/sidebar/workspace-rail"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks/use-workspace"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import {
  agentTarget,
  conversationTarget,
  type DeleteTarget,
} from "@/lib/delete-targets"

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
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
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

  function rowProps(conversation: Conversation) {
    const channel = conversation.kind === "channel"
    return {
      conversation,
      current: conversation.id === currentId,
      unread: unread[conversation.id] ?? 0,
      onNavigate: () => onOpenChange(false),
      deletion: {
        label: `Delete ${channel ? "#" : ""}${conversation.name}`,
        hint: channel ? "Delete channel" : "Delete group chat",
        onClick: () => setDeleting(conversationTarget(conversation, agents)),
      },
    }
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
              <SidebarSection
                title="Channels"
                action={{
                  label: "Create a channel",
                  onClick: () => setDialog("channel"),
                }}
              >
                {channels.map((channel) => (
                  <ConversationRow key={channel.id} {...rowProps(channel)}>
                    {channel.private ? (
                      <LockIcon aria-hidden="true" />
                    ) : (
                      <HashIcon aria-hidden="true" />
                    )}
                    <span>{channel.name}</span>
                  </ConversationRow>
                ))}
              </SidebarSection>
              <SidebarSection
                title="Group chats"
                action={{
                  label: "Start a group chat",
                  onClick: () => setDialog("chat"),
                }}
              >
                {groups.map((group) => (
                  <ConversationRow key={group.id} {...rowProps(group)}>
                    <UsersIcon aria-hidden="true" />
                    <span>{group.name}</span>
                  </ConversationRow>
                ))}
              </SidebarSection>
              <SidebarSection
                title="Agents"
                action={{
                  label: "New agent",
                  href: "/agents/new",
                  onClick: () => onOpenChange(false),
                }}
              >
                {agents.map((agent) => {
                  const dm = directMessages.find((item) =>
                    item.members.includes(`agent:${agent.id}`)
                  )
                  return (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      directMessage={dm}
                      current={dm?.id === currentId}
                      unread={dm ? (unread[dm.id] ?? 0) : 0}
                      onNavigate={() => onOpenChange(false)}
                      onOpenDirectMessage={() => void openDirectMessage(agent)}
                      deletion={{
                        label: `Delete ${agent.name}`,
                        hint: "Delete agent",
                        onClick: () =>
                          setDeleting(agentTarget(agent, conversations)),
                      }}
                    />
                  )
                })}
              </SidebarSection>
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
      <DeleteDialog
        target={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onDeleted={() => {
          const left = deleting?.conversationIds.includes(currentId)
          setDeleting(null)
          if (left) navigate("/")
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
