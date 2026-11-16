import { z } from "zod"
import type { SessionState } from "../api-types.ts"
import { homeShort } from "../paths.ts"
import { tool, ToolError, type Tool } from "./rpc.ts"
import type { Conversation, Store, TimelineEntry } from "../store/store.ts"

export type ChatServer = {
  store: Store
  liveState(agentId: string, conversationId: string): SessionState
  agentState(agentId: string): SessionState
  authorName(authorKey: string): string
  postMessage(
    conversationId: string,
    agentId: string,
    text: string
  ): TimelineEntry
  createGroupOrChannel(
    body: Record<string, unknown>
  ):
    | { ok: true; conversation: Conversation }
    | { ok: false; body: Record<string, unknown> }
  addMembers(
    conversation: Conversation,
    agentIds: string[]
  ):
    | { ok: true; conversation: Conversation | undefined }
    | { ok: false; error: string }
}

export type Caller = { agentId: string; conversationId: string }

export function chatTools(chat: ChatServer, caller: Caller): Tool[] {
  const { store } = chat

  function memberConversation(conversationId = caller.conversationId) {
    const conversation = store.getConversation(conversationId)
    if (!conversation?.members.includes(`agent:${caller.agentId}`)) {
      throw new ToolError(
        `You are not a member of the conversation "${conversationId}".`
      )
    }
    return conversation
  }

  function agentIdsNamed(names: string[]): string[] {
    const agents = store.listAgents()
    return names.map((name) => {
      const agent = agents.find((item) => item.name === name)
      if (!agent) throw new ToolError(`No agent has the name "${name}".`)
      return agent.id
    })
  }

  return [
    tool(
      "get_conversation",
      "Read a conversation: its kind, name, topic, reply mode, and each member with its state. With no conversationId, read this conversation.",
      z.object({
        conversationId: z
          .string()
          .optional()
          .describe("The ID of a conversation where you are a member."),
      }),
      ({ conversationId }) => {
        const conversation = memberConversation(conversationId)
        return {
          id: conversation.id,
          kind: conversation.kind,
          name: conversation.name,
          topic: conversation.topic,
          replyMode: conversation.replyMode,
          thisConversation: conversation.id === caller.conversationId,
          members: conversation.members.map((memberKey) => {
            if (!memberKey.startsWith("agent:")) {
              return { name: "User", kind: "user" }
            }
            const agentId = memberKey.slice("agent:".length)
            return {
              name: store.getAgent(agentId)?.name ?? "agent",
              kind: "agent",
              state: chat.liveState(agentId, conversation.id),
              you: agentId === caller.agentId,
            }
          }),
        }
      }
    ),
    tool(
      "list_conversations",
      "List each conversation where you are a member: its ID, kind, name and topic.",
      z.object({}),
      () =>
        store
          .listConversations()
          .filter((conversation) =>
            conversation.members.includes(`agent:${caller.agentId}`)
          )
          .map((conversation) => ({
            id: conversation.id,
            kind: conversation.kind,
            name: conversation.name,
            topic: conversation.topic,
            thisConversation: conversation.id === caller.conversationId,
          }))
    ),
    tool(
      "list_agents",
      "List each agent of the chat app: its name, its state over all its conversations, and its folder.",
      z.object({}),
      () =>
        store.listAgents().map((agent) => ({
          name: agent.name,
          state: chat.agentState(agent.id),
          folder: homeShort(agent.cwd),
          you: agent.id === caller.agentId,
        }))
    ),
    tool(
      "read_messages",
      "Read the messages of a conversation, oldest first: the last messages before the seq `before`, or the last messages. `more` is true when older messages exist. With no conversationId, read this conversation.",
      z.object({
        conversationId: z
          .string()
          .optional()
          .describe("The ID of a conversation where you are a member."),
        before: z
          .number()
          .int()
          .optional()
          .describe("Give only the messages before this seq."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("The number of messages, 50 at most."),
      }),
      ({ conversationId, before, limit }) => {
        const conversation = memberConversation(conversationId)
        const messages = store.listTimeline(conversation.id).flatMap((entry) =>
          entry.item.kind === "message" &&
          entry.item.status === "done" &&
          (before === undefined || entry.seq < before)
            ? [
                {
                  seq: entry.seq,
                  author: chat.authorName(entry.authorKey),
                  at: entry.createdAt,
                  text: entry.item.text,
                  ...(entry.item.files ? { files: entry.item.files } : {}),
                },
              ]
            : []
        )
        return {
          messages: messages.slice(-limit),
          more: messages.length > limit,
        }
      }
    ),
    tool(
      "send_message",
      "Send a message as yourself to a conversation where you are a member. Each agent that the message mentions with @name gets a turn there. With no conversationId, send it to this conversation at once, before your turn ends.",
      z.object({
        conversationId: z
          .string()
          .optional()
          .describe("The ID of a conversation where you are a member."),
        text: z
          .string()
          .trim()
          .min(1, "Write a message.")
          .describe("The message, in Markdown."),
      }),
      ({ conversationId, text }) => {
        const conversation = memberConversation(conversationId)
        const entry = chat.postMessage(conversation.id, caller.agentId, text)
        return { seq: entry.seq }
      }
    ),
    tool(
      "start_conversation",
      "Start a group chat or a channel with other agents, and send its first message as yourself. You and the user are members. Mention an agent in the message to give it a turn. For a channel, give a name of lowercase letters, numbers and hyphens.",
      z.object({
        kind: z.enum(["group", "channel"]),
        agentNames: z
          .array(z.string())
          .min(1)
          .describe("The names of the other agents."),
        name: z.string().optional().describe("The name of a channel."),
        topic: z.string().optional().describe("The topic of a channel."),
        text: z
          .string()
          .trim()
          .min(1, "Write a message.")
          .describe("The first message, in Markdown."),
      }),
      ({ kind, agentNames, name, topic, text }) => {
        const others = agentIdsNamed(agentNames).filter(
          (agentId) => agentId !== caller.agentId
        )
        const made = chat.createGroupOrChannel({
          kind,
          name,
          topic,
          agentIds: [caller.agentId, ...new Set(others)],
        })
        if (!made.ok) throw new ToolError(String(made.body.error))
        const entry = chat.postMessage(
          made.conversation.id,
          caller.agentId,
          text
        )
        return {
          conversationId: made.conversation.id,
          kind: made.conversation.kind,
          name: made.conversation.name,
          seq: entry.seq,
        }
      }
    ),
    tool(
      "add_members",
      "Add agents to a group chat or a channel where you are a member. A new member sees only the messages after it joins.",
      z.object({
        conversationId: z
          .string()
          .describe("The ID of a conversation where you are a member."),
        agentNames: z
          .array(z.string())
          .min(1)
          .describe("The names of the agents to add."),
      }),
      ({ conversationId, agentNames }) => {
        const added = chat.addMembers(
          memberConversation(conversationId),
          agentIdsNamed(agentNames)
        )
        if (!added.ok) throw new ToolError(added.error)
        return {
          name: added.conversation?.name,
          members: added.conversation?.members.map(chat.authorName),
        }
      }
    ),
  ]
}
