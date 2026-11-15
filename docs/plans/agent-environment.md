# Give each agent a chat MCP server, and skills to use it

**Status:** phase 2, awaiting go-ahead. Phase 1 (the rule of the
environment) is done and merged on 2026-11-15. What it built is in
`docs/agent-environment.md`. The user answered Q1 to Q4 on 2026-11-15, and
no question is open.

Each `claude` process gets an MCP server, `chat`, that lets the agent read
conversations, send messages to other agents, and start a conversation. A
section of `agent/environment.md` and three skills tell the agent how to use
it.

## Measured on 2026-11-15 (Claude Code 2.1.311)

A probe with no prompt (so it cost nothing, F25) showed that
`--mcp-config '<json>'` with an `http` server that does not answer does not
stop `initialize`. This becomes finding F34 in `docs/protocol.md` when the
build records it again.

## Decisions

**D4. The agent server hosts the MCP server at `POST /mcp`.** It is the
Streamable HTTP transport with no state and JSON answers, so there is no
second process and the tools call the store and the conversation code
directly. `buildArgs()` adds `--mcp-config` with one `http` server, `chat`.
It does not add `--strict-mcp-config`, because an agent keeps the MCP
servers of the user (`docs/architecture.md`).
Rejected: a stdio server for each process, because it must call the HTTP
API back, and it adds one Node process to each agent.

**D5. A token identifies the session.** At `start()`, the server makes a
random token for the live session and puts it in the `Authorization` header
of the MCP configuration. `/mcp` finds the agent and the conversation from
the token, and refuses a token of a session that is no longer live. The
token is not a lock: the server listens only on `127.0.0.1` and has no
sign-in. It stops a mix-up, and it stops an old process that acts for a new
session.

**D6. A tool input is a Zod schema.** `z.toJSONSchema()` gives the
`inputSchema` of `tools/list`, and the same schema checks the arguments of
`tools/call`, as `server/schemas.ts` does for the forms.

## Resolved

**Q1. Our own MCP code, or `@modelcontextprotocol/sdk`?** Our own, about 150
lines for `initialize`, `notifications/initialized`, `ping`, `tools/list` and
`tools/call`. It follows the decision "our own small driver" in
`docs/architecture.md`, and a live check records the real lines.
Rejected: the SDK. It handles more of the specification, but adds a package
and hides the lines.

**Q2. Which `chat` tools ask for permission?** The read tools need no card,
because the server adds them to `--allowedTools`. The write tools show an
approval card, as each other tool does in the `default` mode.
Rejected: no card for any tool, and a card for each tool.

**Q3. The tool set of the first version.** All seven tools:

| Tool                 | Input                                                                  | Result                                                                  | Kind  |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| `get_conversation`   | `conversationId?` (default: this one)                                  | Kind, name, topic, reply mode, members with name, state and "you"       | read  |
| `list_conversations` |                                                                        | The conversations of this agent: ID, kind, name and topic               | read  |
| `list_agents`        |                                                                        | Each agent: name, state, folder (`~` short)                             | read  |
| `read_messages`      | `conversationId?`, `before?`, `limit` ≤ 50                             | The complete messages, oldest first: `seq`, author name, time, text     | read  |
| `send_message`       | `conversationId?` (default: this one), `text`                          | The new `seq`. Its mentions give turns, as a message of this agent does | write |
| `start_conversation` | `kind` (`group` or `channel`), `agentNames`, `name?`, `topic?`, `text` | The new conversation. The user is always a member                       | write |
| `add_members`        | `conversationId`, `agentNames`                                         | The conversation                                                        | write |

An agent reads and writes only in a conversation where it is a member.
Agents cannot DM each other, because a DM is between the user and one agent.

**Q4. Can `send_message` post in the conversation of the turn?** Yes. An
agent can post a progress message during a long turn. The rule says that the
reply of the turn is already a message, so the agent uses the tool here only
for a message that must go out before the turn ends.
Rejected: an error for the conversation of the turn.

## Data flows

### A tool call

```
claude ──POST /mcp (Bearer <token>)──▶ createServer()
                                         tokens.get(token) -> LiveSession
                                         tools/call send_message
                                           store.saveItems(agent message)
                                           publish item + unread
                                           mentionedAgents() -> prompt()
       ◀── { content: [{ type: "text", text: "Sent as seq 41." }] }
```

A message from the tool is a timeline item of the agent with the item ID
`<session id>/mcp-<n>`, so it does not collide with the items of the
reducer. It follows the same path as a message of the user from the browser,
except the author.

## Workflows

- **Ask an agent that is a member here.** Mention it. No tool.
- **Ask an agent that is not a member here.** Find a shared conversation
  with `list_conversations`, or make a group chat with
  `start_conversation`, and write a message that holds all the context. The
  answer comes in that conversation, in another session of the agent. The
  skill `ask-an-agent` says this, and says to read the answer later with
  `read_messages`.
- **Hand off a task.** `hand-off`: a brief with the goal, what is done, the
  files, and what "done" means. Then stop the turn.
- **Catch up.** After New session, or when a prompt starts in the middle of a
  thread: `catch-up` reads `read_messages` before it answers.

## The build

1. `/mcp`: JSON-RPC with `initialize`, `tools/list` and `ping`, test-first
   with `fetch`, as the other route tests do.
2. Each tool, one slice at a time, through `tools/call`.
3. The token, `--mcp-config`, and the read tools in `--allowedTools`.
4. The section "The chat tools" in `agent/environment.md`, and the three
   skills.
5. Live check: a Haiku turn calls `get_conversation`. Record a fixture of an
   MCP tool call, so `reduceTimeline()` gets a test for its tool card.
6. Docs: a new `docs/mcp.md`, and changes to `docs/server.md`,
   `docs/protocol.md` (F34), `docs/architecture.md` (the decision and
   the risk below) and `CLAUDE.md`.

## Risks

- **A chain across conversations.** `send_message` with a mention starts a
  turn in another conversation, and Stop stops one conversation only. The
  skills say "mention only to ask for work", and the rule says each turn
  costs money. A limit is not in this plan.
- **The rule can go stale in a long process.** The members at the start can
  change. The new section of the rule says "call `get_conversation` for the
  current members".
- **A user MCP server named `chat`.** It would collide. The server name can
  change in one constant.
