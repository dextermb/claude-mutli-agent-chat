import { useCallback, useEffect, useState } from "react"

import type {
  Conversation,
  ConversationAgent,
  SharedFile,
  SharedFileView,
  StreamMessage,
  TimelineEntry,
} from "@/lib/agent-api"
import { refusalOf } from "@/lib/refusal"

type ConversationView = {
  status: "loading" | "ready" | "error"
  conversation: Conversation | null
  agents: ConversationAgent[]
  entries: TimelineEntry[]
  files: SharedFileView[]
  deleted: boolean
}

const LOADING: ConversationView = {
  status: "loading",
  conversation: null,
  agents: [],
  entries: [],
  files: [],
  deleted: false,
}

export function useConversation(conversationId: string) {
  const [view, setView] = useState<ConversationView>(LOADING)

  useEffect(() => {
    let current = true
    let source: EventSource | null = null
    async function load() {
      const [detail, timeline, shared] = await Promise.all([
        getJson<{ conversation: Conversation; agents: ConversationAgent[] }>(
          `/api/conversations/${conversationId}`
        ),
        getJson<{ items: TimelineEntry[]; lastEventId: number }>(
          `/api/conversations/${conversationId}/timeline`
        ),
        getJson<{ files: SharedFileView[] }>(
          `/api/conversations/${conversationId}/files`
        ).catch(() => ({ files: [] })),
      ])
      if (!current) return
      setView({
        status: "ready",
        conversation: detail.conversation,
        agents: detail.agents,
        entries: timeline.items,
        files: shared.files,
        deleted: false,
      })
      source = new EventSource(
        `/api/conversations/${conversationId}/events?lastEventId=${timeline.lastEventId}`
      )
      source.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as StreamMessage
        if (message.type === "reset") {
          source?.close()
          start()
          return
        }
        setView((view) => applyMessage(view, message))
        if (message.type === "conversation") {
          getJson<{ agents: ConversationAgent[] }>(
            `/api/conversations/${conversationId}`
          )
            .then(({ agents }) => {
              if (current) setView((view) => ({ ...view, agents }))
            })
            .catch(() => undefined)
        }
      }
    }
    function start() {
      load().catch(() => {
        if (current) setView({ ...LOADING, status: "error" })
      })
    }
    start()
    return () => {
      current = false
      source?.close()
    }
  }, [conversationId])

  const send = useCallback(
    (text: string, files: SharedFile[] = []) =>
      postJson(
        `/api/conversations/${conversationId}/messages`,
        files.length > 0 ? { text, files } : { text }
      ),
    [conversationId]
  )
  const answer = useCallback(
    (requestId: string, body: RequestAnswer) =>
      postJson(`/api/requests/${requestId}`, body),
    []
  )
  const stop = useCallback(
    () => postJson(`/api/conversations/${conversationId}/stop`, {}),
    [conversationId]
  )

  const stopAgent = useCallback(
    (agentId: string) =>
      postJson(
        `/api/conversations/${conversationId}/agents/${agentId}/stop`,
        {}
      ),
    [conversationId]
  )

  const newSession = useCallback(
    (agentId: string) =>
      postJson(
        `/api/conversations/${conversationId}/agents/${agentId}/sessions`,
        {}
      ),
    [conversationId]
  )

  const removeMember = useCallback(
    (agentId: string) =>
      refusalOf(
        fetch(`/api/conversations/${conversationId}/members/${agentId}`, {
          method: "DELETE",
        })
      ),
    [conversationId]
  )

  const removeFile = useCallback(
    (fileId: string) =>
      refusalOf(
        fetch(`/api/conversations/${conversationId}/files/${fileId}`, {
          method: "DELETE",
        })
      ),
    [conversationId]
  )

  return {
    ...view,
    removeFile,
    send,
    answer,
    stop,
    stopAgent,
    newSession,
    removeMember,
  }
}

export type RequestAnswer =
  | { decision: "allow_once" | "always_allow" | "deny" }
  | { answers: Record<string, string> }

function applyMessage(
  view: ConversationView,
  message: StreamMessage
): ConversationView {
  if (message.type === "conversation") {
    return { ...view, conversation: message.conversation }
  }
  if (message.type === "files") {
    return { ...view, files: message.files }
  }
  if (
    message.type === "reset" ||
    message.type === "line" ||
    message.type === "unread" ||
    message.type === "agent_deleted"
  ) {
    return view
  }
  if (message.type === "conversation_deleted") {
    return { ...view, deleted: true }
  }
  if (message.type === "agent_state") {
    return {
      ...view,
      agents: view.agents.map((agent) =>
        agent.id === message.agentId
          ? { ...agent, state: message.state }
          : agent
      ),
    }
  }
  const { entry } = message
  const known = view.entries.some((existing) => existing.id === entry.id)
  return {
    ...view,
    entries: known
      ? view.entries.map((existing) =>
          existing.id === entry.id ? entry : existing
        )
      : [...view.entries, entry],
  }
}

function postJson(url: string, body: unknown): Promise<string | null> {
  return refusalOf(
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return (await response.json()) as T
}
