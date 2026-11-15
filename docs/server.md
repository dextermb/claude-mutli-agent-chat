# The agent server

The agent server is a Node HTTP server (`node:http`, no framework). It holds
the store, starts a `claude` process for each agent, and sends the timeline to
the browser.

```sh
pnpm server   # http://127.0.0.1:4100
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

| Route                                  | Body                            | Result                                                   |
| -------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `GET /api/agents`                      |                                 | `{ agents }`, by name                                    |
| `POST /api/agents`                     | The agent                       | `201 { agent }`. `400` if a field is empty               |
| `GET /api/agents/:id`                  |                                 | `{ agent }`. `404` for an unknown agent                  |
| `PATCH /api/agents/:id`                | Some fields of the agent        | `{ agent }`. The other fields stay                       |
| `GET /api/conversations`               |                                 | `{ conversations }`                                      |
| `POST /api/conversations`              | `{ kind: "dm", agentId }`       | `201 { conversation }`, or `200` with the DM that exists |
| `GET /api/conversations/:id`           |                                 | `{ conversation, agents }`, each agent with its `state`  |
| `POST /api/conversations/:id/messages` | `{ text }`                      | `202 { entry }`. `404` for an unknown conversation       |
| `GET /api/conversations/:id/timeline`  |                                 | `{ items, lastEventId }`                                 |
| `GET /api/conversations/:id/events`    |                                 | The event stream (SSE)                                   |
| `POST /api/conversations/:id/stop`     |                                 | `202`. Interrupts each busy agent                        |
| `POST /api/requests/:requestId`        | `{ decision }` or `{ answers }` | `202`. `404` if the request is not open                  |

An agent needs a `name`, a `cwd`, a `model` and a `permissionMode`. An empty
`cwd` would start `claude` in the folder of the server, so the server refuses
it. An empty `systemPrompt` is stored as `null`.

The state of an agent with no live process is `exited`.

## A message

1. The store keeps the message as an item of `user:me`, and the stream sends
   it.
2. Each agent member of the conversation gets the text as a prompt.
3. If the agent has no live process, the server starts one. It makes a new
   session row, with the Claude session ID of the latest row of that agent in
   that conversation. So `buildArgs()` adds `--resume`, and the agent keeps its
   memory after a server start.
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

The counter starts at 1 again when the server starts. So after a server
start, the browser must load the timeline again.

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

## Not handled yet

- No route creates a group chat or a channel.
- The event log of a conversation is never cut, so it grows while the server
  runs.
- An empty message is accepted.
- Each agent member gets each message. Mentions and the reply mode come with
  group chats and channels.
