# The agent server

The agent server is a Node HTTP server (`node:http`, no framework). It holds
the store, starts a `claude` process for each agent, and sends the timeline to
the browser.

```sh
pnpm dev:server   # http://127.0.0.1:4100
```

| Variable          | Default           |
| ----------------- | ----------------- |
| `PORT`            | `4100`            |
| `AGENTS_DATABASE` | `.data/agents.db` |

The server listens only on `127.0.0.1`, because an agent can run shell
commands. There is one user, `user:me`, and no sign-in.

`server/main.ts` starts the real server. `createServer({ store, startSession })`
in `server/http/server.ts` does the work, so a test can give it a
`startSession` that starts the fake `claude` (`docs/agents.md`).

## Routes

| Route                                                  | Body                                    | Result                                                                                                                                                |
| ------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/agents`                                      |                                         | `{ agents }`, by name                                                                                                                                 |
| `POST /api/agents`                                     | The agent                               | `201 { agent }`. `400` if a field is empty                                                                                                            |
| `GET /api/agents/:id`                                  |                                         | `{ agent }`. `404` for an unknown agent                                                                                                               |
| `PATCH /api/agents/:id`                                | Some fields of the agent                | `{ agent }`. The other fields stay                                                                                                                    |
| `POST /api/agents/:id/stop`                            |                                         | `202`. Stops the agent in each conversation. `404` for an unknown agent                                                                               |
| `GET /api/conversations`                               |                                         | `{ conversations, unread }`. `unread` gives the unread count of each conversation that has one                                                        |
| `POST /api/conversations`                              | A DM, a group chat or a channel         | `201 { conversation }`, or `200` with the DM that exists                                                                                              |
| `GET /api/conversations/:id`                           |                                         | `{ conversation, agents }`, each agent with its `state`                                                                                               |
| `PATCH /api/conversations/:id`                         | Some of `topic`, `private`, `replyMode` | `{ conversation }`. The other fields stay. `400` for a DM, a group chat or a bad field. See `docs/conversations.md`                                   |
| `POST /api/conversations/:id/messages`                 | `{ text }`                              | `202 { entry }`. `400` for an empty message. `404` for an unknown conversation                                                                        |
| `POST /api/conversations/:id/read`                     | `{ seq }`                               | `204`. The user saw the conversation up to `seq`. `400` with no integer `seq`. `404` for an unknown conversation                                      |
| `GET /api/conversations/:id/timeline`                  |                                         | `{ items, lastEventId }`                                                                                                                              |
| `GET /api/conversations/:id/events`                    |                                         | The event stream (SSE)                                                                                                                                |
| `GET /api/events`                                      |                                         | The app stream (SSE)                                                                                                                                  |
| `POST /api/conversations/:id/stop`                     |                                         | `202`. Interrupts each busy agent                                                                                                                     |
| `GET /api/conversations/:id/agents/:agentId/session`   |                                         | `{ session }`, the session card. Before the first process, the card holds the configuration of the agent, with no session ID, 0 turns and a cost of 0 |
| `POST /api/conversations/:id/agents/:agentId/stop`     |                                         | `202`. Interrupts that agent and empties its queue                                                                                                    |
| `POST /api/conversations/:id/agents/:agentId/sessions` |                                         | `201 { session }`. New session. `404` if the agent is not a member                                                                                    |
| `POST /api/conversations/:id/members`                  | `{ agentIds }`                          | `{ conversation }`. `400` for a DM. See `docs/conversations.md`                                                                                       |
| `DELETE /api/conversations/:id/members/:agentId`       |                                         | `{ conversation }`. `400` for a DM or the last agent of a group chat                                                                                  |
| `GET /api/conversations/:id/agents/:agentId/log`       | `?before=<seq>`                         | `{ lines }`: the last 200 stored lines of that agent in that conversation, or the 200 before `seq`                                                    |
| `POST /api/requests/:requestId`                        | `{ decision }` or `{ answers }`         | `202`. `404` if the request is not open                                                                                                               |
| `POST /mcp`                                            | JSON-RPC                                | The `chat` MCP server of the agents. `403` with no token of a live session. See `docs/mcp.md`                                                         |

An agent needs a `name`, a `cwd`, a `model` and a `permissionMode`. An empty
`cwd` would start `claude` in the folder of the server, so the server refuses
it. An empty `systemPrompt` is stored as `null`. The server checks an agent
and a channel with the schemas in `server/schemas.ts`, and a refused body
gets `400 { error, fields }` (`docs/forms.md`).

The state of an agent with no live process is `exited`.

## A message

1. The store keeps the message as an item of `user:me`, and the stream sends
   it.
2. Each agent that the message addresses gets a prompt. The rules and the
   shape of the prompt are in `docs/conversations.md`.
3. If the agent has no live process, the server starts one. It makes a new
   session row, with the Claude session ID and the `claudeSessionNew` flag of
   the latest row of that agent in that conversation. So `buildArgs()` adds
   `--resume` (or `--session-id` before the first turn, see
   `docs/agents.md`), and the agent keeps its memory after a server start.
   The row also keeps the configuration of the agent at the start, in
   `config`.
4. Each agent session has a queue. A prompt goes to the process only when the
   session is `idle`. A prompt that comes while the agent is `starting`,
   `busy` or `waiting` waits in the queue.

One session row holds the lines of one process. A new process starts its
reducer again at `item-1`, so a new row keeps its item IDs apart from the
items of the earlier process.

## Session events

The server writes each event of a session to the store, then to the stream:

| Session event    | Store                                                | Stream                                    |
| ---------------- | ---------------------------------------------------- | ----------------------------------------- |
| `line`           | `recordLine()`                                       |                                           |
| `changes`        | `saveItems()` with the `seq` of the last stdout line | `{ type: "item", entry }` for each item   |
| `state`          | `updateSession({ state })`                           | `{ type: "agent_state", agentId, state }` |
| `claude_session` | `updateSession({ claudeSessionId })`                 |                                           |
| `exit`           | `updateSession({ endedAt, exitCode, stderr })`       |                                           |

When the state becomes `failed`, the server also adds a `notice` item with
`reason: "failed"`, the exit code and the stderr, and sends it as an `item`
event. Its item ID is `<session id>/exit`. The stderr goes to the local
database and the local browser only. It never goes into a prompt.

After `exited` or `failed`, the session is no longer live. The next message
starts a new process.

## The event stream

Each conversation has its own event counter, in memory. Each event has an
`id` from that counter and one JSON object in `data`:

```
id: 7
data: {"type":"item","entry":{"id":"…","seq":12,"authorKey":"agent:…","item":{…}}}
```

The browser loads the timeline first, then opens the stream from the
`lastEventId` of the timeline. A browser `EventSource` cannot set a header on
its first request, so the stream also takes `?lastEventId=<n>`. The
`Last-Event-ID` header wins when both are there. A stream with neither gets
only new events. The server then
sends each event after that ID, so no event goes missing between the two
requests. A stream that connects again does the same.

Each stream keeps the last 500 events (`eventLogSize` of `createServer()`).
A browser can ask for an event that the stream no longer holds, or for an ID
that is higher than the last ID, which happens after a server start, because
the counter starts at 1 again. In both cases, the server sends one event
with no ID, `{ "type": "reset" }`, in place of the old events. The browser
then loads its data again and opens a new stream.

A change of members or of the settings of a channel also sends
`{ type: "conversation", conversation }` on the stream of that conversation.

Each line that a process writes or reads also goes to the open streams of
its conversation as `{ type: "line", agentId, line }`, for the Session log.
This event has no ID, and it is not in the log of the stream, so a stream
that connects again does not get it. Text arrives in many small lines, and
these lines would push the other events out of the log of 500.

### The app stream

`GET /api/events` is one more stream, for the whole app. It works in the
same way, with its own counter and log. It sends:

| Event                                       | When                                                               |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `{ type: "agent_state", agentId, state }`   | The state of an agent over all its sessions changes                |
| `{ type: "conversation", conversation }`    | The server makes a conversation, or its members or settings change |
| `{ type: "unread", conversationId, count }` | The unread count of a conversation changes                         |

The unread count of a conversation counts the agent items for the user to
read after the place that the user saw last: messages, notices, permission
requests and questions (`docs/store.md`). Tool calls, turn summaries and
dividers do not count. The server checks the count after it saves the items
of an agent, after the notice of a failed process, and after a read. It keeps
the last count that it sent for each conversation, and sends an `unread`
event only when the count changes. A read sends the count 0. The divider of a new session sends none, because
the user starts it from the open page.

The state of an agent follows the rule of `GET /api/agents`
(`docs/conversations.md`). The server sends it before it gives the next
prompt to the agent, so each step shows, also `idle` between two turns.

## Answers

The server keeps each open approval card and question card in memory, by its
request ID. `POST /api/requests/:requestId` builds the answer to
`can_use_tool` (`docs/protocol.md`):

| Body                                                    | Answer to Claude Code                                         |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `{ "decision": "allow_once" }`                          | `{ behavior: "allow", updatedInput: input }`                  |
| `{ "decision": "always_allow" }`                        | The same, with `updatedPermissions` set to the suggestions    |
| any other `decision`                                    | `{ behavior: "deny", message: "The user denied this." }`      |
| `{ "answers": { question: label } }` on a question card | `{ behavior: "allow", updatedInput: { questions, answers } }` |

The card changes when the echo of the answer comes back on stdout.

## Stop

`POST /api/conversations/:id/stop` empties the queue of each agent session in
the conversation, and interrupts each session that is `busy` or `waiting`.
Each interrupted turn ends as `stopped`.

`POST /api/conversations/:id/agents/:agentId/stop` does the same for one
agent. This is Stop turn on the session card.

`POST /api/agents/:id/stop` is Stop agent on the agent page. For each live
session of the agent, in each conversation, it empties the queue, interrupts
the turn, and stops the process. The agent becomes `exited`. Its session rows
keep their Claude session IDs, so the next message starts it again with
`--resume`, and it remembers each conversation.

## Sessions

`sessionCard()` gives the session card of an agent in a conversation, from
its latest session row:

| Field                                     | From                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `claudeSessionId`                         | The row                                                                                        |
| `state`                                   | The live process, or `exited`                                                                  |
| `model`, `permissionMode`, `allowedTools` | `config` of the row: what the process runs with                                                |
| `directory`                               | `config.cwd`, with the home folder as `~`                                                      |
| `turns`, `costUsd`                        | The sums of `numTurns` and `costUsd` of the turn items of each row with that Claude session ID |
| `configChanged`                           | True when the agent configuration now differs from `config`                                    |

A change to an agent does not reach a process that runs. The card shows the
configuration that runs, and `configChanged` says that New session would use
the new one.

**New session** (`POST …/agents/:agentId/sessions`):

1. Interrupt the turn of the agent, empty its queue, and stop its process.
2. Make a session row with a new UUID as the Claude session ID,
   `claudeSessionNew` set, and the configuration of now.
3. Add a `session_start` item of the agent to the timeline, and send it.
4. In a group chat or a channel, move the prompt cursor of the agent to the
   `seq` of that item. So the first prompt holds only the messages after it.
   After a server start, the fallback (the last item of the agent) is that
   item too.
5. Start a process. It gets `--session-id <uuid>`.

**Autostart.** `server/main.ts` calls `server.autostart()` after `listen()`.
For each agent with `autostart` that has a DM, it starts the process of that
DM with no prompt. It costs nothing (F25), but the `SessionStart` hooks of
the user run (F23). An agent with no DM does not start, and the server does
not make a DM for it.
