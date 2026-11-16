# The chat MCP server

Each `claude` process gets one MCP server, `chat`. Its tools let an agent read
the chat app, send messages to other agents, and start a conversation. The
agent server hosts it at `POST /mcp`, so there is no second process, and a
tool calls the store and the conversation code directly.

The rule of the environment lists the tools, and the skills of the `chat`
plugin tell the agent how to use them (`docs/agent-environment.md`).

## The parts

| Part                    | What it holds                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| `server/mcp/rpc.ts`     | JSON-RPC: `answerRpc(message, tools)`, `Tool`, `ToolError`                |
| `server/mcp/tools.ts`   | `chatTools(chat, caller)`: the eight tools, and `READ_TOOLS`              |
| `server/http/server.ts` | The route, the tokens, and the `ChatServer` functions that the tools call |

`answerRpc()` knows nothing about the chat. `chatTools()` knows nothing about
HTTP. `createServer()` gives the tools a `ChatServer`: the store, the states,
and the functions that the routes also use (`postMessage`,
`createGroupOrChannel`, `addMembers`). So a tool and a route cannot disagree.

## The command line

`buildArgs()` adds:

```
--mcp-config '{"mcpServers":{"chat":{"type":"http","url":"http://127.0.0.1:<port>/mcp",
               "headers":{"Authorization":"Bearer <token>"}}}}'
--allowedTools <the rules of the agent> mcp__chat__get_conversation
               mcp__chat__list_conversations mcp__chat__list_agents
               mcp__chat__read_messages
```

There is no `--strict-mcp-config`, because an agent keeps the MCP servers of
the user. A user MCP server with the name `chat` would collide. The name is
`CHAT_SERVER` in `server/mcp/tools.ts`.

## The token

`start()` gives each live session a random token. `/mcp` finds the session
from the `Authorization` header, so a tool knows the agent and the
conversation of the call. When the process ends, the token goes. So:

- A wrong or old token gets `403`. It is not `401`, because a `401` makes
  Claude Code start an OAuth sign-in.
- New session starts a process with a new token.

The token is not a lock. The server listens only on `127.0.0.1` and has no
sign-in. It stops a mix-up of two sessions.

## The protocol

The Streamable HTTP transport with no state: one JSON answer for each POST,
no `Mcp-Session-Id`, and no event stream.

| Request                      | Answer                                                                   |
| ---------------------------- | ------------------------------------------------------------------------ |
| `initialize`                 | The asked version if the server knows it, else `2025-11-25`. `tools: {}` |
| `notifications/…` (no `id`)  | `202` with no body                                                       |
| `ping`                       | `{}`                                                                     |
| `tools/list`                 | Each tool with its description and the JSON Schema of its input          |
| `tools/call`                 | `content` with one text block. A refusal also has `isError: true`        |
| `tools/call` of no such tool | The error `-32602`                                                       |
| Any other method             | The error `-32601`                                                       |
| `GET` or `DELETE`            | `405`                                                                    |

Claude Code 2.1.311 first sends `server/discover` with the version
`2026-07-28`. After the error `-32601`, it falls back to `initialize` with
`2025-11-25` (F35 in `docs/protocol.md`). It connects when the process
starts, before the first prompt.

A Zod schema checks the input of each tool, and `z.toJSONSchema()` gives the
`inputSchema` of `tools/list`. A refused input gives the Zod message with
`isError: true`, so the agent can correct the call.

## The tools

An agent reads and writes only in a conversation where it is a member. With
no `conversationId`, a tool uses the conversation of the session.

| Tool                 | Input                                               | Result                                                                                                         | Card |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---- |
| `get_conversation`   | `conversationId?`                                   | Kind, name, topic, reply mode, folder, members (`state`, `you`)                                                | No   |
| `list_conversations` |                                                     | ID, kind, name, topic and `thisConversation` of each of its conversations                                      | No   |
| `list_agents`        |                                                     | Name, state over all conversations, own folder or `null`, and `you`                                            | No   |
| `read_messages`      | `conversationId?`, `before?`, `limit` (1 to 50, 20) | `messages` (`seq`, author, `at`, text, `files` if any), oldest first, and `more`                               | No   |
| `list_files`         | `conversationId?`                                   | `files`: `id`, `name`, absolute `path`, `kind`, `size`, `sharedBy`, `sharedAt`, `exists`. Not the removed ones | No   |
| `send_message`       | `conversationId?`, `text`                           | `{ seq }`                                                                                                      | Yes  |
| `start_conversation` | `kind`, `agentNames`, `name?`, `topic?`, `text`     | `{ conversationId, kind, name, seq }`                                                                          | Yes  |
| `add_members`        | `conversationId`, `agentNames`                      | `{ name, members }`, with names                                                                                | Yes  |

- `get_conversation` gives the folder of a channel with `~`, or `null`. The
  folder of a process can differ from it after a change (`docs/agents.md`).
- `list_agents` gives the own folder of each agent. A generic agent has
  `null`, because it works in the folder of each channel.
- `read_messages` gives only complete messages, with no tool calls.
- `start_conversation` makes the caller a member, after the user and before
  the other agents. It refuses an unknown agent name, and a channel that
  `channelSchema` refuses or that exists.
- `add_members` refuses a DM.

## A message from a tool

```
send_message / start_conversation
  -> postMessage(conversationId, agentId, text)
       store.addMessage(conversationId, "agent:<id>", text)   session_id NULL
       publish { type: "item", entry }, then the unread count
       mentionedAgents(conversationId, text, agentId) -> prompt()
```

- The rules of a message of an agent apply: each other agent that the text
  mentions gets a turn, and the reply mode does not apply
  (`docs/conversations.md`).
- The item has a UUID and no session, like a message of the user. A rebuild
  deletes the items of a session and plays its lines again, so an item with
  a session would go.
- A message to the conversation of the turn goes out at once, before the
  turn ends. The reply of the turn is a second message.
- A message to another conversation reaches the session of the agent in that
  conversation. The answer comes there, not in the session that sent it.

## Add a tool

1. Write a test in `server/http/mcp.test.ts` that calls it with `callChat()`.
2. Add it to `chatTools()` with `tool(name, description, schema, run)`.
   Throw a `ToolError` for a refusal that the agent can correct.
3. If it only reads, add its name to `READ_TOOLS`, so it needs no card.
4. Add it to the tool table of `agent/environment.md` and of this page.
