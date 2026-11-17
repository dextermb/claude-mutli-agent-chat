# The store

The server keeps its data in one SQLite file, with `node:sqlite` (Node 24).
`server/store/store.ts` holds each query, and `server/store/schema.ts` holds
the tables. No other module writes SQL.

`node:sqlite` prints an `ExperimentalWarning` when it loads. This is expected.

## Open the store

```ts
const store = openStore("data/agents.db") // or ":memory:" in a test
```

`openStore()` makes each table that does not exist, and runs each migration
that the file does not have yet (see "Migrations"). Then it does the work of
a server start, because no `claude` process from before is still alive:

- Each approval card and question card that is `pending` becomes `expired`.
- Each session that is not `exited` or `failed` becomes `exited`.

The next prompt to an agent starts a new process with `--resume` and the
stored Claude session ID.

## Migrations

`SCHEMA` in `server/store/schema.ts` is version 1. `MIGRATIONS` lists each
later version. `PRAGMA user_version` holds the version of a file. A file from
before the migrations has version 0, and its tables are version 1.

`openStore()` runs each migration with a higher version, in order. Each one
runs in one transaction with its SQL, its rebuild and the new
`user_version`. So a failure leaves the file at the version before it.

| Version | Change                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| 2       | `agent_sessions` gets `ended_at`, `exit_code` and `stderr`. Each timeline is built again  |
| 3       | `agent_sessions` gets `config` (JSON, null for older rows) and `claude_session_new`       |
| 4       | `conversation_members` gets `joined_seq`, 0 for older rows                                |
| 5       | New table `conversation_reads`                                                            |
| 6       | `agents` gets `description`, null for older rows                                          |
| 7       | `agents` gets `max_turns`, null (no limit) for older rows                                 |
| 8       | `agents` is built again with a nullable `cwd`. `conversations` gets `cwd`, null           |
| 9       | New table `shared_files`                                                                  |
| 10      | `agents` and `conversations` get `sleep_after_minutes`, and `agent_sessions` `end_reason` |
| 11      | New table `conversation_summaries`                                                        |
| 12      | `agents` gets `deleted_at`, null for older rows                                           |
| 13      | `conversations` gets `rules`, null for older rows                                         |

A migration with `foreignKeysOff: true` runs with the foreign keys off, and
checks them with `PRAGMA foreign_key_check` before it commits. SQLite cannot
change a column, so a migration builds the table again, and a `DROP TABLE`
with the foreign keys on would delete each row that points at it.
`node:sqlite` turns the foreign keys on by default.

A migration with `rebuild: true` builds the timeline of each session again
from its stored lines. Use it when a change to the reducer must reach the
stored items.

`server/test/schema-v1.ts` holds the version 1 schema, so a test can make a
file of that version and open it.

## Tables

```
agents ──1:N── agent_sessions ──1:N── session_events
   │                 │
   │                 └──1:N── timeline_items (session_id, nullable)
   │
conversations ──1:N── conversation_members
      ├──────1:N── timeline_items ──1:N── shared_files (item_id, nullable)
      ├──────1:N── shared_files
      ├──────1:N── conversation_summaries
      └──────1:1── conversation_reads
```

| Table                    | Holds                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents`                 | The configuration (`cwd` is null for a generic agent), the description and the turn limit (`max_turns`, null for none) of each agent. The tool lists are JSON arrays. The `config` of a session row from before version 7 reads with `maxTurns: null`, so the session card does not say that it changed                          |
| `conversations`          | Each channel, group chat and DM, with the folder (`cwd`) of a channel, and the `rules` of a channel or a group chat, or null                                                                                                                                                                                                     |
| `conversation_members`   | `user:me` or `agent:<id>`, with a `position` that keeps the order, and the `joined_seq` when the member joined                                                                                                                                                                                                                   |
| `agent_sessions`         | One `claude` process for one agent in one conversation: its Claude session ID and whether that ID is new (`claude_session_new`), the configuration it started with (`config`), its state, and its exit (`ended_at`, `exit_code`, the last 4 KB of `stderr`, and `end_reason`: `sleep`, or null, see `docs/sleep.md`)             |
| `session_events`         | Each line that the session wrote (`in`) or read (`out`), without a change                                                                                                                                                                                                                                                        |
| `timeline_items`         | Each timeline item, with its full value as JSON in `payload`                                                                                                                                                                                                                                                                     |
| `conversation_reads`     | For each conversation, the `last_read_seq` that the user saw and the time (`read_at`). No row: the user saw nothing                                                                                                                                                                                                              |
| `conversation_summaries` | One summary of a conversation for each `through_seq`, the last message that it covers, with its `text` and `cost_usd`. The latest one is in use, and the older ones stay as history (`docs/sleep.md`). `ON DELETE CASCADE` with the conversation                                                                                 |
| `shared_files`           | The list of shared files of each conversation: `name`, absolute `path`, `kind` (`linked` or `copied`), `size`, `shared_by`, `shared_at`, and `removed_at` and `removed_by` once the user removes it. One row for each path of a conversation (`UNIQUE (conversation_id, path)`). `item_id` names the last message that shared it |

A delete of a conversation deletes its sessions, members and items. An agent
is never deleted from the table: `deleteAgent()` sets `deleted_at` and removes
its memberships (`docs/delete.md`). The foreign keys still delete the
sessions and members of an agent row. A delete of a conversation also deletes its read and its shared files. A delete of a message item keeps its shared files, with `item_id` set to null. A delete of a session keeps its items, with `session_id` set to null.

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
item kept. With no `seq`, it takes the next one, so the item comes after each
item that is stored now. The server does this for an item that no stdout line
added, such as the notice of a failed process.

Use one session row for each process. A new process starts its reducer again
at `item-1`, so it needs a new row, or its items replace the items of the
earlier process.

`addUserMessage(conversationId, text)` stores a message of `user:me` with a
new UUID. `addMessage(conversationId, authorKey, text)` does the same for any
author. The `chat` tools use it for a message of an agent, so that message
has no `session_id`, and a rebuild of the session keeps it (`docs/mcp.md`).

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

| Function                                                                                                                         | Result                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createAgent(agent)`, `getAgent(id)`                                                                                             | An agent. `getAgent()` also finds a deleted agent, with its `deletedAt`                                                                                                            |
| `listAgents()`                                                                                                                   | Each agent that is not deleted, by name                                                                                                                                            |
| `deleteAgent(id)`                                                                                                                | Deletes its DM and each group chat where it is the last agent, removes it from the others, and sets `deleted_at`. Gives back `deletedConversationIds` and `changedConversationIds` |
| `deleteConversation(id)`                                                                                                         | Deletes the conversation and, by the foreign keys, its members, sessions, items, read, summaries and shared files                                                                  |
| `listAuthorKeys(id)`                                                                                                             | Each author key of the items of a conversation, once                                                                                                                               |
| `createConversation(c)`, `getConversation(id)`                                                                                   | A conversation with its members in order                                                                                                                                           |
| `addMember(id, memberKey)`, `removeMember(id, memberKey)`                                                                        | Adds a member at the end with the `joined_seq` of now, or removes it                                                                                                               |
| `joinedSeq(id, memberKey)`                                                                                                       | The place where a member joined                                                                                                                                                    |
| `updateConversation(id, { name, topic, private, replyMode, cwd, rules })`                                                        | Changes the given fields only, and gives back the conversation                                                                                                                     |
| `createSession({ agentId, conversationId })`, `getSession(id)`                                                                   | A session, `starting` at first                                                                                                                                                     |
| `updateSession(id, { claudeSessionId, state, endedAt, exitCode, stderr })`                                                       | Changes the given fields only                                                                                                                                                      |
| `recordLine()`, `listLines(sessionId)`                                                                                           | The lines of a session, in order                                                                                                                                                   |
| `listAgentLines(agentId, conversationId, { limit, before })`                                                                     | The lines of each session of that agent in that conversation, the last `limit` before `before`, in order                                                                           |
| `saveItems()`, `addMessage()`, `listTimeline(conversationId)`                                                                    | The timeline                                                                                                                                                                       |
| `listSessionTurns(agentId, conversationId, claudeSessionId)`                                                                     | The turn items of each row with that Claude session ID                                                                                                                             |
| `lastCompaction(agentId, conversationId, claudeSessionId)`                                                                       | The last compaction item with the status `done` of those rows, with its `createdAt`                                                                                                |
| `latestSummary(conversationId)`, `saveSummary(summary)`                                                                          | The summary with the highest `through_seq`, and a new one                                                                                                                          |
| `rebuildTimeline(sessionId)`                                                                                                     | The items of a session, from its lines                                                                                                                                             |
| `markRead(id, seq)`, `unreadCounts()`                                                                                            | Keeps the higher `seq` of the two, and counts the agent items of kind `message`, `notice`, `permission` and `question` after the `last_read_seq` of each conversation              |
| `shareFiles(id, itemId, files, sharedBy)`, `listSharedFiles(id)`, `getSharedFile(fileId)`, `removeSharedFile(fileId, removedBy)` | Adds or updates a row for each path (and puts back a removed one), lists each row, removed ones too, newest first, and marks a row removed                                         |
| `close()`                                                                                                                        | Closes the database                                                                                                                                                                |

## Not stored yet

- The cost and the turns of a session. The `turn` items hold them, and the
  session card adds them up. That is fast enough, so a stored copy would only
  add a second truth.
