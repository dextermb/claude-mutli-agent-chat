import {
  EllipsisIcon,
  FolderIcon,
  HashIcon,
  LockIcon,
  MenuIcon,
  SettingsIcon,
  CpuIcon,
  SquareIcon,
  UsersIcon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useParams, useSearch } from "wouter"

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { AddMembersDialog } from "@/components/dialogs/add-members-dialog"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ChannelSettingsDialog } from "@/components/dialogs/channel-settings/channel-settings-dialog"
import { Composer } from "@/components/conversation/composer/composer"
import { ContextFigure } from "@/components/conversation/composer/context-figure"
import { ModelLink } from "@/components/conversation/composer/model-link"
import { FilesPanel } from "@/components/conversation/files/files-panel"
import { SharedFilesList } from "@/components/conversation/files/shared-files-list"
import { Separator } from "@/components/ui/separator"
import { useDropZone } from "@/components/conversation/drop-zone"
import { FilesTab } from "@/components/conversation/files/files-tab"
import { RefusalAlert } from "@/components/alerts/refusal-alert"
import { SessionLogTab } from "@/components/conversation/session/session-log-tab"
import { SharedFilesContext } from "@/components/conversation/files/shared-files-context"
import { MembersPanel } from "@/components/conversation/session/members-panel"
import { SessionPanel } from "@/components/conversation/session/session-panel"
import { SessionSheet } from "@/components/conversation/session/session-sheet"
import { Timeline } from "@/components/conversation/timeline/timeline"
import { entryAnchor } from "@/lib/timeline"
import { WorkingLines } from "@/components/conversation/working-line"
import { useAttachments } from "@/hooks/use-attachments"
import { useConversation } from "@/hooks/use-conversation"
import { useMarkRead } from "@/hooks/use-mark-read"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSessionCard } from "@/hooks/use-session-card"
import type {
  AgentWithState,
  Conversation,
  TimelineEntry,
} from "@/lib/agent-api"

export default function ConversationPage() {
  const params = useParams<{ id: string }>()
  const conversation = useConversation(params.id)
  const attachments = useAttachments(params.id)
  const agentList = conversation.agents
  const searchPaths = useCallback(
    async (query: string) => {
      const response = await fetch(
        `/api/conversations/${params.id}/paths?q=${encodeURIComponent(query)}`
      )
      if (!response.ok) return []
      const { paths } = (await response.json()) as {
        paths: { path: string; relative: string; agentId: string }[]
      }
      return paths.map((match) => ({
        path: match.path,
        relative: match.relative,
        agentName:
          agentList.find((agent) => agent.id === match.agentId)?.name ?? "",
      }))
    },
    [params.id, agentList]
  )
  const dropZone = useDropZone(
    attachments,
    conversation.conversation?.kind === "channel"
      ? `#${conversation.conversation.name}`
      : (conversation.conversation?.name ?? "")
  )
  const agent = conversation.agents[0]
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [showingSheet, setShowingSheet] = useState(false)
  const [showingMembers, setShowingMembers] = useState(false)
  const [showingFiles, setShowingFiles] = useState(false)
  const [showingSidebar, setShowingSidebar] = useState(false)
  const isMobile = useIsMobile()
  useMarkRead(params.id, conversation.entries.at(-1)?.seq)
  const [refusal, setRefusal] = useState<{
    conversationId: string
    reason: string
  } | null>(null)
  const search = useSearch()
  const [, navigate] = useLocation()
  const tab = new URLSearchParams(search).get("tab") ?? "messages"
  const focusEntry = useRef<string | null>(null)
  function showTab(value: string) {
    navigate(
      value === "messages"
        ? `/conversations/${params.id}`
        : `/conversations/${params.id}?tab=${value}`,
      { replace: true }
    )
  }
  useEffect(() => {
    if (tab !== "messages" || !focusEntry.current) return
    document.getElementById(entryAnchor(focusEntry.current))?.focus()
    focusEntry.current = null
  }, [tab])
  const panelAgent =
    conversation.conversation?.kind === "dm"
      ? agent
      : conversation.agents.find((member) => member.id === pickedId)
  const turnsOfAgent = conversation.entries.filter(
    (entry) =>
      entry.authorKey === `agent:${panelAgent?.id}` &&
      (entry.item.kind === "turn" || entry.item.kind === "session_start")
  ).length
  const shownRefusal =
    refusal?.conversationId === params.id ? refusal.reason : null
  function showRefusal(reason: string | null) {
    setRefusal(reason === null ? null : { conversationId: params.id, reason })
  }
  const card = useSessionCard(
    params.id,
    panelAgent?.id,
    `${panelAgent?.state} ${turnsOfAgent}`
  )

  if (conversation.status === "loading") {
    return (
      <p className="p-6 text-muted-foreground">Loading the conversation.</p>
    )
  }
  if (conversation.status === "error" || !conversation.conversation) {
    return (
      <p className="p-6 text-destructive">The conversation did not load.</p>
    )
  }

  const isDirect = conversation.conversation.kind === "dm"
  const addLabel =
    conversation.conversation.kind === "channel"
      ? "Invite agents"
      : "Add people or agents"
  const status = agent ? statusOf(agent.state) : null
  const panel = panelAgent && {
    agentId: panelAgent.id,
    card,
    working: panelAgent.state === "busy" || panelAgent.state === "waiting",
    agentName: panelAgent.name,
    onStopTurn: () => conversation.stopAgent(panelAgent.id),
    onNewSession: () => conversation.newSession(panelAgent.id),
    onRemove: isDirect
      ? undefined
      : async () => {
          const refusal = await conversation.removeMember(panelAgent.id)
          if (!refusal) setPickedId(null)
          return refusal
        },
  }
  const working = conversation.agents.filter(
    (member) => member.state === "busy" || member.state === "waiting"
  )
  const people = conversation.conversation.members.filter((member) =>
    member.startsWith("user:")
  ).length
  const agentCount = conversation.agents.length
  const sharedCount = conversation.files.filter(
    (file) => file.removedAt === null
  ).length
  return (
    <div className="flex h-svh bg-background text-sm text-foreground">
      <AppSidebar
        currentId={params.id}
        open={showingSidebar}
        onOpenChange={setShowingSidebar}
      />
      <Tabs
        value={isDirect ? tab : "messages"}
        onValueChange={(value: string) => showTab(value)}
        render={<main className="flex min-w-0 flex-1 flex-col" />}
      >
        <header className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
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
          {isDirect && agent && (
            <Avatar size="sm">
              <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                {initialsOf(agent.name)}
              </AvatarFallback>
              {status && <AvatarBadge className={status.dot} />}
            </Avatar>
          )}
          <div className="flex items-center gap-1.5 text-foreground-strong">
            {!isDirect && <KindIcon conversation={conversation.conversation} />}
            <h1 className="m-0 text-base font-semibold">
              {conversation.conversation.name}
            </h1>
          </div>
          {isDirect && status && (
            <Badge variant="outline" className={status.text}>
              <span className={`size-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </Badge>
          )}
          {conversation.conversation.kind === "channel" && (
            <span className="min-w-40 text-[13px] text-foreground-faint">
              {conversation.conversation.topic && (
                <span>{conversation.conversation.topic} </span>
              )}
              <span>
                {conversation.conversation.replyMode === "every"
                  ? "Agents reply to every message."
                  : "Agents reply when you @mention them."}
              </span>
            </span>
          )}
          <div className="min-w-4 flex-1" />
          {working.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => showRefusal(await conversation.stop())}
            >
              <SquareIcon />
              {isDirect ? "Stop" : "Stop all"}
            </Button>
          )}
          {!isDirect && (
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showingMembers}
              aria-label={`Members: ${people} ${
                people === 1 ? "person" : "people"
              }, ${agentCount} ${agentCount === 1 ? "agent" : "agents"}`}
              onClick={() => {
                setShowingFiles(false)
                setShowingMembers(!showingMembers)
              }}
            >
              <AvatarGroup>
                {conversation.agents.slice(0, 3).map((member) => (
                  <Avatar key={member.id} size="sm">
                    <AvatarFallback className={AVATAR_COLOURS[member.colour]}>
                      {initialsOf(member.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              {people + agentCount}
            </Button>
          )}
          {conversation.conversation.kind === "channel" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Channel settings"
              onClick={() => setConfiguring(true)}
            >
              <EllipsisIcon />
            </Button>
          )}
          {!isDirect && (
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showingFiles}
              aria-label={`Shared files: ${sharedCount}`}
              onClick={() => {
                setShowingMembers(false)
                setShowingFiles(!showingFiles)
              }}
            >
              <FolderIcon />
              {sharedCount}
            </Button>
          )}
          {isDirect && !isMobile && (
            <TabsList>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="log">Session log</TabsTrigger>
            </TabsList>
          )}
          {isDirect && agent && !isMobile && (
            <Link
              href={`/agents/${agent.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <SettingsIcon />
              Configure
            </Link>
          )}
          {isDirect && isMobile && (
            <Button
              variant="outline"
              size="sm"
              aria-expanded={showingSheet}
              onClick={() => setShowingSheet(true)}
            >
              <CpuIcon />
              Session
            </Button>
          )}
        </header>
        {isDirect && agent && (
          <TabsContent value="files" className="min-h-0 flex-1 overflow-y-auto">
            <section
              aria-labelledby="shared-files-heading"
              className="flex flex-col gap-3 px-5 pt-5"
            >
              <h2
                id="shared-files-heading"
                className="m-0 text-sm font-semibold text-foreground-strong"
              >
                Shared files
              </h2>
              <SharedFilesList
                files={conversation.files}
                entries={conversation.entries}
                agents={conversation.agents}
                onRemove={async (file) =>
                  showRefusal(await conversation.removeFile(file.id))
                }
              />
            </section>
            <Separator className="mx-5 mt-5 w-auto" />
            <FilesTab
              entries={conversation.entries}
              cwd={agent.sessionCwd}
              agentName={agent.name}
              onOpen={(entryId) => {
                focusEntry.current = entryId
                navigate(`/conversations/${params.id}`, { replace: true })
              }}
            />
          </TabsContent>
        )}
        {isDirect && agent && (
          <TabsContent value="log" className="min-h-0 flex-1 overflow-y-auto">
            <SessionLogTab conversationId={params.id} agentId={agent.id} />
          </TabsContent>
        )}
        <TabsContent
          value="messages"
          className="relative flex min-h-0 flex-1 flex-col"
          {...dropZone.handlers}
        >
          {dropZone.overlay}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isDirect && agent && (
              <div className="flex flex-col items-start gap-2 px-5 pt-4 pb-2">
                <Avatar size="lg">
                  <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                    {initialsOf(agent.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="m-0 max-w-[520px] leading-[22px] text-muted-foreground">
                  This is your DM with{" "}
                  <strong className="text-foreground-strong">
                    {agent.name}
                  </strong>
                  . In a DM, the agent replies to every message. It runs Claude
                  Code in{" "}
                  <code className="font-mono text-[13px] text-agent-yellow">
                    {agent.sessionCwd}
                  </code>
                  .
                </p>
              </div>
            )}
            <SharedFilesContext.Provider
              value={{
                files: conversation.files,
                entries: conversation.entries,
                agents: conversation.agents,
              }}
            >
              <Timeline
                entries={conversation.entries}
                agents={conversation.agents}
                onAnswer={async (requestId, answer) => {
                  const refusal = await conversation.answer(requestId, answer)
                  showRefusal(refusal)
                  return refusal === null
                }}
              />
            </SharedFilesContext.Provider>
            <WorkingLines
              agents={conversation.agents}
              entries={conversation.entries}
            />
          </div>
          <div className="flex flex-col gap-1.5 px-5 pb-4">
            {isDirect &&
              conversation.agents.map((member) => {
                const line = statusLine(member, conversation.entries)
                return (
                  line && (
                    <p
                      key={member.id}
                      className="m-0 flex items-center gap-2 text-xs text-foreground-faint"
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2 flex-none rounded-full ${statusOf(member.state).dot}`}
                      />
                      {line}
                    </p>
                  )
                )
              })}
            {shownRefusal && (
              <RefusalAlert
                refusal={shownRefusal}
                onClose={() => setRefusal(null)}
              />
            )}
            <Composer
              members={conversation.agents}
              label={`Message ${
                conversation.conversation.kind === "channel" ? "#" : ""
              }${conversation.conversation.name}`}
              attachments={attachments}
              searchPaths={searchPaths}
              tools={
                isDirect &&
                agent && (
                  <>
                    <ModelLink agentId={agent.id} model={agent.model} />
                    {card?.context && <ContextFigure context={card.context} />}
                  </>
                )
              }
              onSend={async (text, files) =>
                showRefusal(await conversation.send(text, files))
              }
            />
          </div>
        </TabsContent>
      </Tabs>
      {!isDirect && (
        <AddMembersDialog
          open={adding}
          title={addLabel}
          submitLabel={
            conversation.conversation.kind === "channel" ? "Invite" : "Add"
          }
          conversation={conversation.conversation}
          onOpenChange={setAdding}
        />
      )}
      {conversation.conversation.kind === "channel" && (
        <ChannelSettingsDialog
          open={configuring}
          conversation={conversation.conversation}
          onOpenChange={setConfiguring}
        />
      )}
      {isDirect && panel && isMobile && (
        <SessionSheet
          key={panel.agentId}
          {...panel}
          open={showingSheet}
          onOpenChange={setShowingSheet}
          views={{
            current: tab,
            onShow: (view) => {
              showTab(view)
              setShowingSheet(false)
            },
            configureHref: `/agents/${panel.agentId}`,
          }}
        />
      )}
      {isDirect && panel && !isMobile && (
        <SessionPanel key={panel.agentId} {...panel} />
      )}
      {!isDirect && (
        <FilesPanel
          asSheet={isMobile}
          open={showingFiles}
          onClose={() => setShowingFiles(false)}
          files={conversation.files}
          entries={conversation.entries}
          agents={conversation.agents}
          onRemove={async (file) =>
            showRefusal(await conversation.removeFile(file.id))
          }
        />
      )}
      {!isDirect && (
        <MembersPanel
          asSheet={isMobile}
          open={showingMembers}
          onClose={() => setShowingMembers(false)}
          people={people}
          agents={conversation.agents}
          pickedId={pickedId}
          onPick={setPickedId}
          details={panel ?? null}
          addLabel={addLabel}
          onAdd={() => setAdding(true)}
        />
      )}
    </div>
  )
}

function KindIcon({ conversation }: { conversation: Conversation }) {
  if (conversation.kind === "group") {
    return <UsersIcon aria-hidden="true" className="size-[18px]" />
  }
  return conversation.private ? (
    <LockIcon aria-hidden="true" className="size-[18px]" />
  ) : (
    <HashIcon aria-hidden="true" className="size-[18px]" />
  )
}

function statusLine(
  member: AgentWithState,
  entries: TimelineEntry[]
): string | null {
  const next = "Your next message waits until this turn ends."
  if (member.state === "busy") return `${member.name} is working. ${next}`
  if (member.state === "failed") {
    return `${member.name} stopped. Your next message starts it again and resumes the session.`
  }
  if (member.state !== "waiting") return null
  return asksQuestion(member, entries)
    ? `${member.name} waits for your answer. ${next}`
    : `${member.name} needs your approval. ${next}`
}

function asksQuestion(agent: AgentWithState, entries: TimelineEntry[]) {
  return entries.some(
    (entry) =>
      entry.authorKey === `agent:${agent.id}` &&
      entry.item.kind === "question" &&
      entry.item.status === "pending"
  )
}
