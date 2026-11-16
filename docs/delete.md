# Delete a channel, a group chat or an agent

The user can delete a channel, a group chat or an agent. Each delete asks
first in one confirm dialog, and it cannot be undone.

## Two ways in

| Way in                        | Where                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| The × of a row in the sidebar | Each channel, group chat and agent row (`docs/web-app/sidebar.md`) |
| Delete channel                | Channel settings, from the ⋯ of the channel header                 |
| Delete group chat             | Group chat settings, from the ⋯ of the group chat header           |
| Delete agent                  | The end of the agent page (`docs/web-app/agent-page.md`)           |

Both ways open `src/components/dialogs/delete-dialog.tsx`, an `AlertDialog`
with a title, "You cannot undo this.", and a list of what goes.
`src/lib/delete-targets.ts` builds the title, the list, the route and the
conversations that go:

- `conversationTarget()`: "Delete #release-train?" or "Delete this group
  chat?". The list says that the messages and the shared files are deleted,
  that the sessions of its agents end, and that the agents stay.
- `agentTarget()`: "Delete test-runner?". The list says that a turn that runs
  now stops, which conversations the agent leaves, which group chats go
  because it is their last agent, that its DM goes, and that its files stay.

The settings dialog closes when the confirm dialog opens. While the request
runs, the Delete button is disabled and shows a spinner. A refusal shows
"Delete channel did not work." (or the action of that dialog) and the reason,
and the dialog stays open. After a delete, the page goes to `/` if it showed a
conversation that went. `src/components/dialogs/delete-section.tsx` is the
bordered Delete section of the two settings dialogs and the agent page.

## A conversation

`DELETE /api/conversations/:id`:

1. `404` for an unknown conversation. `400` for a DM: "A DM goes with its
   agent. Delete the agent."
2. For each live session in it: empty the queue, interrupt the turn, and stop
   the process. The server waits for each process to end, so no late line
   writes to a conversation that is gone.
3. `deleteConversation()` deletes the row. The foreign keys delete its
   members, sessions, lines, items, read, summaries and shared-file rows
   (`docs/store.md`).
4. The server sends `{ type: "conversation_deleted", conversationId }` on the
   app stream and on the stream of the conversation, then closes the streams
   of the conversation. It forgets the prompt cursors, the notes of removed
   files, the unread count and the summary run of the conversation.
5. It deletes the folder `<uploads>/<conversation id>`, because the app made
   it. It never touches a `linked` file or the scratch folder of an agent.
6. `204`.

## An agent

An agent is not deleted from the table. `deleted_at` marks it, because the
messages of an agent keep its ID as their author, and the name must stay
readable. `timeline_items.author_key` has no foreign key to `agents`.

`DELETE /api/agents/:id`:

1. `404` for an unknown or deleted agent.
2. `stopAgent()` stops each live session of the agent, in each conversation.
3. `deleteAgent()`, in one transaction: delete its DM, delete each group
   chat where it is the last agent, remove it from each other conversation,
   and set `deleted_at`.
4. The server sends `conversation_deleted` for each conversation that went,
   and `conversation` for each one that it left (a group chat takes a new
   name from its agents). Then it sends `{ type: "agent_deleted", agentId }`
   on the app stream.
5. `204`.

After the delete, the routes that take an agent ID treat the agent as
unknown: read, change, stop, restart, a new DM, a new group chat or channel,
and an invite. `GET /api/agents` leaves it out. `getAgent()` still finds it,
so a prompt to another agent still names the author of its old messages.

A new agent can take the name of a deleted agent. The app tells them apart by
ID.

## Authors that are no longer members

`GET /api/conversations/:id` gives `authors`: each agent that wrote an item of
the conversation and is not a member now. It holds a removed member and a
deleted agent. The timeline finds an author in `agents` first, then in
`authors`. A deleted author shows the outline Badge "Deleted agent" in place
of "Agent".

## The browser

- `useWorkspace()` takes a conversation off its list at
  `conversation_deleted`, with its unread count, and an agent off its list at
  `agent_deleted`.
- `useConversation()` sets `deleted` at `conversation_deleted`. The
  conversation page then goes to `/`. So a delete in another tab moves this
  tab too.
