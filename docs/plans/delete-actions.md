# Delete channels, group chats and agents

**Status:** in progress. The user agreed the decisions, the answers below and
the seams under test on 2026-11-16.

Built, with tests: the store (migration 12, `deleteConversation()`,
`deleteAgent()`), both routes and the two stream events, `useWorkspace()`,
the × on each sidebar row with the confirm dialog, the conversation page that
goes home when its conversation is deleted, and Delete agent on the agent page.

Still ahead:

1. Delete channel in Channel settings.
2. Group chat settings (the ⋯ button) with Delete group chat.
3. The label "Deleted agent" in the timeline. `GET /api/conversations/:id`
   must send the deleted authors of its items.
4. A test for a refused delete in the confirm dialog.
5. The docs: `docs/server/routes.md`, `docs/store.md`, `docs/server.md`,
   `docs/web-app/sidebar.md`, `docs/web-app/agent-page.md`.
6. One run of the real app, then the merge.

The design is the row "Delete channels, group chats and agents" of the
"Agent Chat" canvas (`docs/web-app.md`): the × on a sidebar row, Channel
settings, Group chat settings, Delete agent on the agent page, and the two
confirm dialogs.

## Decisions

1. **Two ways in, one confirm dialog.** The × on a sidebar row and the Delete
   button in a settings view open the same `AlertDialog`. No delete happens
   without it. There is no undo.
2. **A conversation is deleted for real.** `DELETE FROM conversations` and the
   cascades remove its members, sessions, lines, items, reads, summaries and
   shared-file rows (`docs/store.md`). The server also deletes the folder
   `<uploads>/<conversation id>`, because the app made it. It never touches a
   `linked` file or the scratch folder of an agent.
3. **An agent gets a tombstone, not a row delete.** A new column
   `agents.deleted_at` marks it. Its messages in channels and group chats keep
   their author, so the timeline can still show "test-runner" with the label
   "Deleted agent", and a prompt to another agent still names it.
   Rejected: a row delete. The cascade keeps the items (they have no foreign
   key to `agents`), but the name of the author is lost, and `authorName()`
   gives "agent".
4. **Delete agent removes it from each conversation.** It stops each live
   process, removes each membership, deletes its DM, and sets `deleted_at`.
   `GET /api/agents` and the `@` list leave it out.
5. **Stop first, then delete.** Each route stops the turn and the process of
   each live session before the store write, the same as
   `DELETE …/members/:agentId` does now.

## Resolved

1. A group chat whose last agent is the deleted agent: **delete it too**, and
   name it in the confirm dialog. The server already refuses a group chat
   with no agent. Rejected: keep it with no agents, where nobody can reply.
2. Group chat settings: **Delete only.** The design shows a Name field, but
   `PATCH /api/conversations/:id` refuses a group chat. The rename is a
   separate change.
3. A new agent **may** take the name of a deleted agent. The timeline tells
   them apart by ID, and the label "Deleted agent" marks the old one.

## ERD

No new table. One new column, migration 12.

```
agents                              conversations
  id            PK                    id   PK
  name                                kind (dm | group | channel)
  …                                   …
  deleted_at    TEXT NULL   NEW         │
     │                                  ├─1:N─ conversation_members  ON DELETE CASCADE
     ├─1:N─ conversation_members        ├─1:N─ agent_sessions        ON DELETE CASCADE
     │      ON DELETE CASCADE           ├─1:N─ timeline_items        ON DELETE CASCADE
     └─1:N─ agent_sessions              ├─1:N─ shared_files          ON DELETE CASCADE
            ON DELETE CASCADE           ├─1:N─ conversation_summaries ON DELETE CASCADE
                                        └─1:1─ conversation_reads    ON DELETE CASCADE
```

The tombstone keeps the `agents` row, so its sessions and lines stay until
their conversation goes. `timeline_items.author_key` is text with no foreign
key, so an item of a deleted agent stays in each case.

## Data flows

**Delete a conversation** (`DELETE /api/conversations/:id`):

1. `404` for an unknown conversation. `400` for a DM: a DM goes with its agent.
2. For each live session in it: empty the queue, interrupt the turn, stop the
   process. Drop its prompt cursors and its open approval cards.
3. `store.deleteConversation(id)`.
4. Delete `<uploads>/<id>`.
5. Send `{ type: "conversation_deleted", conversationId }` on the app stream
   and on the stream of the conversation, then close the streams of the
   conversation.
6. `204`.

**Delete an agent** (`DELETE /api/agents/:id`):

1. `404` for an unknown or deleted agent.
2. `stopAgent(id)` (each live session, each conversation).
3. In one transaction: delete its DM, delete each group chat where it is the
   last agent, remove it from each other conversation, and set `deleted_at`.
4. Send `conversation_deleted` for each deleted conversation,
   `conversation` for each changed one, and `{ type: "agent_deleted",
agentId }` on the app stream.
5. `204`.

**The browser.** `useWorkspace()` takes the two new events off its lists. The
conversation page sees `conversation_deleted` for its own ID and goes to `/`.
The agent page goes to `/` after its own delete.

## Workflows

```
sidebar row ──hover/focus──▶ × ─────────────┐
Channel settings ──Delete channel──▶ ───────┤
Group chat settings ──Delete group chat──▶ ─┼──▶ confirm dialog ──Delete──▶ request
agent page ──Delete agent──▶ ───────────────┘          │ Cancel                │
                                                       ▼                       ├─ 204: close; leave the page if it showed the item
                                                     closed                    └─ refused / no answer: alert in the dialog, it stays open
```

- The Delete button shows a spinner and is disabled while the request runs.
- The confirm text lists what goes. For an agent: the turn that runs now (if
  it works), each conversation it leaves, its DM, and that its files stay.

## The build

**Store** (`server/store/store.ts`, `schema.ts`):

- Migration 12: `ALTER TABLE agents ADD COLUMN deleted_at TEXT`.
- `deleteConversation(id)`, `deleteAgent(id)` (the tombstone and the
  memberships, in one transaction).
- `listAgents()` leaves out a deleted agent. `getAgent(id)` still finds it,
  with `deletedAt`, so `authorName()` keeps the name.

**Server** (`server/http/server.ts`): the two routes above, and the two new
stream events in `server/api-types.ts`.

**App:**

- `src/components/sidebar/conversation-row.tsx` and `agent-row.tsx`: a
  `SidebarMenuAction` with `showOnHover`, an × and a `Tooltip`. It hides the
  unread badge while it shows.
- A new `src/components/dialogs/delete-dialog.tsx`: the confirm dialog, with
  the request, the pending state and the refusal alert
  (`src/components/alerts/refusal-alert.tsx`).
- `channel-settings-dialog.tsx`: a Delete channel section.
- A Group chat settings dialog behind a new ⋯ button in the group chat header.
- The agent page: a Delete agent section at the end.
- The timeline: the label "Deleted agent" next to the name of a deleted
  author. `GET /api/conversations/:id` sends the deleted authors of its items
  with `deletedAt`, so the page can name them.
- `docs/server/routes.md`, `docs/store.md`, `docs/server.md`,
  `docs/web-app/sidebar.md`: the routes, the column, the events and the ×.

## Seams under test

Each one is a public boundary. The tests go next to the file, test-first.

| Seam                                    | Behaviour under test                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The store (`openStore(":memory:")`)     | A deleted conversation leaves no member, item or shared file. A deleted agent keeps its items and its name |
| The HTTP server (`server/test/http.ts`) | Each route: `204`, `404`, `400` for a DM. A live fake `claude` stops. The app stream sends the events      |
| `useWorkspace()`                        | The two events take the row off the lists                                                                  |
| The sidebar (`AppSidebar`)              | The × of a row opens the confirm dialog. Delete sends the request and the row goes                         |
| The conversation page                   | `conversation_deleted` for the open conversation goes to the home page                                     |
| The agent page                          | Delete agent asks first, then goes to the home page                                                        |

## Verify

`pnpm test`, `pnpm lint` and `pnpm build` in the worktree. Then one run of
the app: delete a channel with a live agent, and an agent with a DM, and look
at the sidebar and the timeline of the channel that it left.
