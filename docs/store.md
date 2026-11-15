# The store

The server keeps its data in one SQLite file, with `node:sqlite` (Node 24).
`server/store/store.ts` holds each query, and `server/store/schema.ts` holds
the tables. No other module writes SQL.

`node:sqlite` prints an `ExperimentalWarning` when it loads. This is expected.

## Open the store

```ts
const store = openStore("data/agents.db") // or ":memory:" in a test
```

`openStore()` makes each table that does not exist. Then it does the work of a
server start, because no `claude` process from before is still alive:

- Each approval card and question card that is `pending` becomes `expired`.
- Each session that is not `exited` or `failed` becomes `exited`.

The next prompt to an agent starts a new process with `--resume` and the
stored Claude session ID.

## Tables

```
agents ──1:N── agent_sessions ──1:N── session_events
   │                 │
   │                 └──1:N── timeline_items (session_id, nullable)
   │
conversations ──1:N── conversation_members
      └──────1:N── timeline_items
```

| Table                  | Holds                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `agents`               | The configuration of each agent. The tool lists are JSON arrays                             |
| `conversations`        | Each channel, group chat and DM                                                             |
| `conversation_members` | `user:me` or `agent:<id>`, with a `position` that keeps the order                           |
| `agent_sessions`       | One `claude` session for one agent in one conversation, its Claude session ID and its state |
| `session_events`       | Each line that the session wrote (`in`) or read (`out`), without a change                   |
| `timeline_items`       | Each timeline item, with its full value as JSON in `payload`                                |

A delete of an agent or a conversation deletes its sessions, members and
items. A delete of a session keeps its items, with `session_id` set to null.

## The order of the timeline

One counter gives a `seq` number to each stored line and each user message.
It is one higher than the highest `seq` in `session_events` and
`timeline_items`.

- A user message gets the next number.
- An agent item gets the `seq` of the stdout line that added it. A later
  change to the item does not change its `seq`.
- Two items from one line keep the order in which they were added.

So `listTimeline()` gives the items in the order that they came, and a
rebuild puts each agent item back between the same user messages.

## Write a session

For each `line` event of an `AgentSession` (see `docs/agents.md`):

1. `recordLine(sessionId, direction, text)` stores the line and gives its
   `seq`.
2. For a stdout line, `saveItems(sessionId, changes, seq)` stores the
   `changes` of the reducer with that `seq`.

The ID of an agent item is `<session id>/<item id>`. A second change to the
same item replaces its status and its payload. The author is the agent of the
session. `saveItems()` gives back the stored entries, with the `seq` that each
item kept.

Use one session row for each process. A new process starts its reducer again
at `item-1`, so it needs a new row, or its items replace the items of the
earlier process.

`addUserMessage(conversationId, text)` stores a message of `user:me` with a
new UUID.

Each entry has a `createdAt`. For a user message, it is the time of the
message. For an agent item, it is the `at` of the stdout line that added the
item. A later change to the item keeps it, and a rebuild gives the same
value, because it reads the same line.

## Build the timeline again

`rebuildTimeline(sessionId)` deletes the items of the session, then plays its
stored stdout lines through the reducer again (`docs/timeline.md`). Use it
after a change to the reducer.

The stored lines do not tell that a request expired. So the rebuild keeps the
IDs of the expired items, and it expires them again. The item IDs are the same
in each replay.

## Queries

| Function                                                          | Result                                   |
| ----------------------------------------------------------------- | ---------------------------------------- |
| `createAgent(agent)`, `getAgent(id)`                              | An agent                                 |
| `createConversation(c)`, `getConversation(id)`                    | A conversation with its members in order |
| `createSession({ agentId, conversationId })`, `getSession(id)`    | A session, `starting` at first           |
| `updateSession(id, { claudeSessionId, state })`                   | Changes the given fields only            |
| `recordLine()`, `listLines(sessionId)`                            | The lines of a session, in order         |
| `saveItems()`, `addUserMessage()`, `listTimeline(conversationId)` | The timeline                             |
| `rebuildTimeline(sessionId)`                                      | The items of a session, from its lines   |
| `close()`                                                         | Closes the database                      |

## Not stored yet

- The cost and the turns of a session. The `turn` items hold them.
- When a session ended.
