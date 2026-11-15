# The sidebar and its dialogs

This page gives the sidebar, the hook that fills it, and the dialogs that
start a conversation or add its members.

## The sidebar

`src/components/app-sidebar.tsx` shows on the home page and on the
conversation page. It lists:

- the channels, with `#` or a lock,
- the group chats,
- each agent, with a status dot and its status as text for a screen reader.
  An agent with a DM links to it. An agent with no DM is a button that opens
  one.

The current conversation has `aria-current="page"`.

Below 768 px (`useIsMobile()`), the sidebar is a `Sheet` from the left, not
a column. An "Open the sidebar" button in the header of the page opens it.
The page holds the open state, and gives it to `AppSidebar` as `open` and
`onOpenChange`. Each way to leave the sidebar closes the sheet: a row, an
agent with no DM, Start a chat and Create a channel. The router keeps the
conversation page when the address changes to another conversation, so the
sheet must close itself.

The sidebar gets its lists from `useWorkspace()` (`src/hooks/use-workspace.ts`).
The hook opens the app stream (`/api/events`), then loads
`GET /api/conversations` and `GET /api/agents`. An `agent_state` event
changes the state of that agent. A `conversation` event adds the
conversation, or replaces it if the list holds it. An `unread` event adds the
conversation to the unread IDs, or removes it. A `reset` event loads the
lists again.

A row is bold when an agent wrote in its conversation after the last visit
of the user (`docs/server.md`). A screen reader hears "unread" after its
name: "release-train unread". The row of the open conversation is never
bold, because the page reads each new item at once
(`docs/web-app/conversation.md`).

When an agent works or waits, a footer counts them: "2 agents working · 1
needs approval". With no such agent, the footer is not there.

## Start a chat and Create a channel

Two dialogs that the sidebar opens:

- **Start a chat** (`src/components/start-chat-dialog.tsx`), from the pen
  button. The search filters the agents by name. Each picked agent shows in
  "To:". One agent opens its DM, and two or more agents start a group chat.
  The footer says which one. If the server refuses the chat, the dialog
  shows the reason and stays open.
- **Create a channel** (`src/components/create-channel-dialog.tsx`), from the
  `+` of Channels. It sends the name, the topic, Private, the invited agents
  and the reply mode. It checks the name before it sends (`docs/forms.md`).
  If the server refuses the channel, the dialog shows the reason and stays
  open.

After each one, the page moves to the new conversation. When no answer
comes, each dialog says "The server did not answer." and stays open.

## Members

The header of a group chat has "Add people or agents", and the header of a
channel has "Invite agents", as in the design. Each opens
`src/components/add-members-dialog.tsx`: the agents that are not members,
each with its model and its mode, and a checkbox. Add or Invite sends the
picked agents. If the server refuses, the dialog shows the reason, or "The
server did not answer." when no answer came.
