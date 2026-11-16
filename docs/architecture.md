# Architecture

The user talks to headless Claude Code agents in the browser: in a DM, a group
chat or a channel. This page gives the parts, the main decisions with their
reasons, and the risks. Each part has its own page.

## The parts

```
Browser (Vite + React)                  Agent server (Node 24, server/)
+---------------------------+           +----------------------------------+
| pages, useConversation()  |  POST     | createServer(): routes           |
|                           +---------->|   who gets a turn, prompts       |
|                           |  SSE      |   event stream for each          |
|                           |<----------+   conversation                   |
+---------------------------+           | AgentSession: one claude process |
                                        |   for one agent in one           |
                                        |   conversation                   |
                                        |   stdin/stdout (stream-json)     |
                                        | decodeLine() -> reduceTimeline() |
                                        | Store: node:sqlite               |
                                        +----------------------------------+
```

| Part                        | Page                        |
| --------------------------- | --------------------------- |
| The Claude Code stream      | `docs/protocol.md`          |
| Lines to timeline items     | `docs/timeline.md`          |
| The `claude` process        | `docs/agents.md`            |
| What an agent knows         | `docs/agent-environment.md` |
| The tools of an agent       | `docs/mcp.md`               |
| The tables and queries      | `docs/store.md`             |
| Routes and the event stream | `docs/server.md`            |
| Who gets a turn             | `docs/conversations.md`     |
| Pages and the browser hook  | `docs/web-app.md`           |
| Forms and their schema      | `docs/forms.md`             |

## Decisions

**A Node server in the repository.** The browser cannot start a process, so a
TypeScript server in `server/` holds the `claude` processes. Node 24 runs
`.ts` files with no build step. Vite sends `/api` to it in development.
Rejected: a Vite plugin (it runs only in development), and Next.js (a
rewrite).

**Our own small driver, not the Agent SDK.** The driver writes few kinds of
input line, and each one is measured. The SDK adds a 347 MB binary package
(F19) and hides the raw lines that the store keeps.

**The server makes timeline items.** The browser never reads the protocol. A
pure reducer turns lines into items, so a test can feed it recorded lines.

**Two logs.** The raw lines of each session are the source of truth, because
the transcript of Claude Code has another shape (F13). The timeline items are
a second table, so the browser loads a conversation fast, and the items can
be built again from the lines.

**One session for each agent in each conversation.** So the context of one
conversation does not go into another. One session row holds one process.

**A channel gives its folder to its agents.** A channel is a project, and an
agent can be a generic role with no folder. So one agent can work in two
repositories, in two channels. The folder of the channel wins over the folder
of the agent, and an agent with no folder anywhere gets a scratch folder
outside the repository (`docs/agents.md`). Rejected: a folder for each member
of a channel, because the user must then set it for each agent again.

**Permissions and questions go through `can_use_tool`.** The approval card
and the question card answer the request on stdin. A request has no time
limit (F20), so a card can wait.

**Server-Sent Events for updates, POST for commands.** Each event has an ID,
so a browser that connects again gets what it missed. Rejected: a WebSocket,
because it needs its own reconnect and replay code.

**One local user, with no sign-in.** The server listens only on `127.0.0.1`.

**`node:sqlite`.** It is in Node 24 and needs no package. It prints an
`ExperimentalWarning`. One `Store` module holds each query, so a change to
another library touches one module. Rejected: `better-sqlite3`, a native
package to build.

**An agent loads the user and project settings.** So an agent gets the
user's MCP servers, rules, memory files and hooks, the same as a terminal
session (F23).

**A rule tells each agent about the chat app.** Without it, an agent does
not know that its text is a chat message, that a mention starts a turn that
costs money, or that each conversation is a separate memory. The rule goes
into `--append-system-prompt`, because it must be in each turn, and a skill
loads only on demand. Rejected: a `CLAUDE.md` in the folder of the agent,
because the folder belongs to the user (`docs/agent-environment.md`).

**A lean Haiku process writes the summary of a conversation.** It is the
only `claude` process with no settings of the user, no tools and its own
system prompt, because it reads only the text of the messages. So its base is
about 1k tokens, not 45k (F58, `docs/sleep.md`). An agent always keeps the
environment of the user.

**The facts of the session go in the prompt, not in the system prompt.** A
resume keeps the system prompt of the first process (F40), so a fact in the
system prompt stays old. So the first prompt of each process holds the
facts, and a later prompt holds the facts that changed. Then the system
prompt of an agent is the same in each conversation, and the prompt cache can
share it.

**The agent server hosts the `chat` MCP server.** At `POST /mcp`, so a tool
calls the store and the conversation code directly, with no second process.
A token in the header tells which session calls. The JSON-RPC is our own
code, for the same reason as the driver: few methods, each one measured
(F35). The read tools need no card, and the write tools show an approval
card (`docs/mcp.md`). Rejected: a stdio server for each process, and the
`@modelcontextprotocol/sdk` package.

**Mentions with no limit.** An agent can mention another agent, and the user
stops a chain with Stop. The prompt of a mentioned agent holds the messages
since its last turn (`docs/conversations.md`).

**New session keeps the configuration and chooses the Claude session ID.**
The server passes `--session-id` with a new UUID, so the card shows the ID at
once. The old timeline stays, above a divider.

**One Zod schema for a form and its route.** `server/schemas.ts` holds the
rules, and both the browser (TanStack Form) and the server use them. So the
two never disagree on what a field accepts.

**An open request expires when the server stops.** Its process stops too, so
the request cannot get an answer. The next prompt resumes the session.

## Risks

- **Version drift.** The stream changes between Claude Code versions (F14,
  F17). The decoder keeps a line that it does not know as `unknown`.
- **Shell access.** An agent runs commands on this machine. The server
  listens only on `127.0.0.1`.
- **Cost.** In a channel with the "Every message" mode, each agent pays for
  each message.
- **A chain of mentions has no limit.** Two agents that mention each other run
  until the user clicks Stop. The header shows the busy agents.
- **A chain can cross conversations.** `send_message` with a mention starts a
  turn in another conversation, and Stop stops one conversation only. Each
  write tool shows an approval card, so the user sees each step.
- **User hooks run in each agent.** A slow or failing user hook makes each
  agent slow or makes it fail.
- **Two agents in one folder.** In a channel with a folder, each agent works
  in that folder, so two agents can edit the same files at the same time. The
  rule tells each agent so, but the app does not stop it. An "Always allow"
  rule of one agent also goes into the settings of that folder (F21), so each
  agent there gets it.
- **The prompt cache.** A request that waits for more than one hour loses the
  cache, so the next call costs more.
