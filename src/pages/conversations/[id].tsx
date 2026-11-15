import {
  HashIcon,
  LockIcon,
  SquareIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { useState } from "react"
import { useParams } from "wouter"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { AddMembersDialog } from "@/components/add-members-dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { Composer } from "@/components/conversation/composer"
import { SessionPanel } from "@/components/conversation/session-panel"
import { Timeline } from "@/components/conversation/timeline"
import { useConversation } from "@/hooks/use-conversation"
import { useSessionCard } from "@/hooks/use-session-card"
import type { Conversation } from "@/lib/agent-api"

export default function ConversationPage() {
  const params = useParams<{ id: string }>()
  const conversation = useConversation(params.id)
  const agent = conversation.agents[0]
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const panelAgent =
    conversation.conversation?.kind === "dm"
      ? agent
      : conversation.agents.find((member) => member.id === pickedId)
  const turnsOfAgent = conversation.entries.filter(
    (entry) =>
      entry.authorKey === `agent:${panelAgent?.id}` &&
      (entry.item.kind === "turn" || entry.item.kind === "session_start")
  ).length
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
  const working = conversation.agents.filter(
    (member) => member.state === "busy" || member.state === "waiting"
  )
  return (
    <div className="flex h-svh bg-background text-sm text-foreground">
      <AppSidebar currentId={params.id} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          {isDirect && agent ? (
            <Avatar size="sm">
              <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                {initialsOf(agent.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <KindIcon conversation={conversation.conversation} />
          )}
          <h1 className="m-0 text-base font-semibold text-foreground-strong">
            {conversation.conversation.name}
          </h1>
          {isDirect && status && (
            <Badge variant="outline">
              <span className={`size-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </Badge>
          )}
          {conversation.conversation.topic && (
            <span className="min-w-40 text-[13px] text-foreground-faint">
              {conversation.conversation.topic}
            </span>
          )}
          {!isDirect && (
            <ul
              aria-label="Agents in this conversation"
              className="m-0 flex list-none flex-wrap gap-3 p-0"
            >
              {conversation.agents.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    aria-pressed={member.id === pickedId}
                    className="flex items-center gap-1.5 rounded px-1 text-xs text-muted-foreground hover:bg-accent aria-pressed:text-foreground"
                    onClick={() =>
                      setPickedId(member.id === pickedId ? null : member.id)
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={`size-2 rounded-full ${statusOf(member.state).dot}`}
                    />
                    {`${member.name} ${statusOf(member.state).label}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isDirect && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <UserPlusIcon />
              {addLabel}
            </Button>
          )}
          <div className="min-w-4 flex-1" />
          {working.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                void conversation.stop()
              }}
            >
              <SquareIcon />
              Stop
            </Button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Timeline
            entries={conversation.entries}
            agents={conversation.agents}
            onAnswer={(requestId, answer) => {
              void conversation.answer(requestId, answer)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5 px-5 pb-4">
          {working.map((member) => (
            <p
              key={member.id}
              className="m-0 flex items-center gap-2 text-xs text-foreground-faint"
            >
              <span
                className={`size-2 rounded-full ${statusOf(member.state).dot}`}
              />
              {member.state === "waiting"
                ? `${member.name} waits for your answer.`
                : `${member.name} is working. Your next message waits until this turn ends.`}
            </p>
          ))}
          <Composer
            members={conversation.agents.map((member) => member.name)}
            label={`Message ${
              conversation.conversation.kind === "channel" ? "#" : ""
            }${conversation.conversation.name}`}
            onSend={(text) => {
              void conversation.send(text)
            }}
          />
        </div>
      </main>
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
      {panelAgent && (
        <SessionPanel
          label={isDirect ? "Session" : `Session of ${panelAgent.name}`}
          card={card}
          working={
            panelAgent.state === "busy" || panelAgent.state === "waiting"
          }
          agentName={panelAgent.name}
          onStopTurn={() => {
            void conversation.stopAgent(panelAgent.id)
          }}
          onNewSession={() => {
            void conversation.newSession(panelAgent.id)
          }}
          onClose={isDirect ? undefined : () => setPickedId(null)}
          onRemove={
            isDirect
              ? undefined
              : () => {
                  setPickedId(null)
                  void conversation.removeMember(panelAgent.id)
                }
          }
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
