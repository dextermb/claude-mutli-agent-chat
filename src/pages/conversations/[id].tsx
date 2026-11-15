import { SquareIcon } from "lucide-react"
import { useParams } from "wouter"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { Composer } from "@/components/conversation/composer"
import { Timeline } from "@/components/conversation/timeline"
import { useConversation } from "@/hooks/use-conversation"

export default function ConversationPage() {
  const params = useParams<{ id: string }>()
  const conversation = useConversation(params.id)
  const agent = conversation.agents[0]

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

  const status = agent ? statusOf(agent.state) : null
  const working = conversation.agents.filter(
    (member) => member.state === "busy" || member.state === "waiting"
  )
  return (
    <main className="flex h-svh min-w-0 flex-col bg-background text-sm text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
        {agent && (
          <Avatar size="sm">
            <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
              {initialsOf(agent.name)}
            </AvatarFallback>
          </Avatar>
        )}
        <h1 className="m-0 text-base font-semibold text-foreground-strong">
          {conversation.conversation.name}
        </h1>
        {status && (
          <Badge variant="outline">
            <span className={`size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
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
          label={`Message ${conversation.conversation.name}`}
          onSend={(text) => {
            void conversation.send(text)
          }}
        />
      </div>
    </main>
  )
}
