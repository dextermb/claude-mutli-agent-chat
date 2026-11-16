# The sidebar and its dialogs

This page gives the sidebar, the hook that fills it, and the dialogs that
start a conversation or add its members.

## The sidebar

`src/components/sidebar/app-sidebar.tsx` shows on the home page, the agent page and
the conversation page. It has two columns:

- **The workspace rail** (64 px, `rail` ground, `nav` "Workspace"). It holds
  the "AL" tile, Home, Agents, and the avatar of the user with an online dot.
  Home and Agents link to `/`, because the home page is the agents page.
  Agents is the active button on an agent page, and Home on each other page.
  The rail has no Direct messages page, because the sidebar lists each DM. It
  has no Activity page, because the unread counts and the footer show what is
  new.
- **The sidebar** (256 px, `nav` "Conversations"). It uses the shadcn
  `Sidebar` parts with `collapsible="none"`. It lists:
  - the channels, with `#` or a lock,
  - the group chats,
  - each agent, with a status dot and its status as text for a screen
    reader. An agent with a DM links to it. An agent with no DM is a button
    that opens one.

Each group has a `+`: Create a channel, Start a group chat (it opens Start a
chat), and New agent.

Each row also has an × (`src/components/sidebar/delete-action.tsx`), a
`SidebarMenuAction` with `showOnHover`. It shows when the pointer is on the
row or the row has keyboard focus. Then it takes the place of the unread
count. Its name is "Delete #release-train", "Delete <group chat>" or
"Delete <agent>", and its tooltip is "Delete channel", "Delete group chat" or
"Delete agent". It opens the confirm dialog of `docs/delete.md`. After a
delete that removes the open conversation, the page goes to `/`.

The current conversation has `aria-current="page"` and the `sidebar-primary`
fill.

Below 768 px (`useIsMobile()`), the rail and the sidebar are a `Sheet` from
the left, not a column. An "Open the sidebar" button in the header of the
page opens it. The page holds the open state, and gives it to `AppSidebar` as
`open` and `onOpenChange`. Each way to leave the sidebar closes the sheet: a
row, an agent with no DM, Start a chat and Create a channel. The router keeps
the conversation page when the address changes to another conversation, so
the sheet must close itself.

The sidebar gets its lists from `useWorkspace()` (`src/hooks/use-workspace.ts`).
The hook opens the app stream (`/api/events`), then loads
`GET /api/conversations` and `GET /api/agents`. An `agent_state` event
changes the state of that agent. A `conversation` event adds the
conversation, or replaces it if the list holds it. An `unread` event sets the
unread count of the conversation. The count 0 removes it. A
`conversation_deleted` event removes the conversation and its count, and an
`agent_deleted` event removes the agent. A `reset` event
loads the lists again.

A row with an unread count is bold, and shows the count in a yellow badge
(`mention`). The count is the number of agent items for the user to read
after the last visit (`docs/server.md`). A screen reader hears the count after
the name: "release-train 2 unread". The row of the open conversation never
shows a count, because the page reads each new item at once
(`docs/web-app/conversation.md`).

When an agent works or waits, a footer counts them: "2 agents working · 1
needs approval". With no such agent, the footer is not there.

## Start a chat and Create a channel

Two dialogs that the sidebar opens:

- **Start a chat** (`src/components/dialogs/start-chat-dialog.tsx`), from the pen
  button. The search filters the agents by name. Each picked agent shows in
  "To:". One agent opens its DM, and two or more agents start a group chat.
  The footer says which one. If the server refuses the chat, the dialog
  shows the reason and stays open.
- **Create a channel** (`src/components/dialogs/create-channel-dialog.tsx`), from the
  `+` of Channels. It sends the name, the topic, Private, the invited agents
  and the reply mode. It checks the name before it sends (`docs/forms.md`).
  If the server refuses the channel, the dialog shows the reason and stays
  open.

After each one, the page moves to the new conversation. When no answer
comes, each dialog says "The server did not answer." and stays open.

## Members

The members panel of a group chat has "Add people or agents", and the members
panel of a channel has "Invite agents" (`docs/web-app/session-panel.md`).
Each opens `src/components/dialogs/add-members-dialog.tsx`. Its description depends on
the reply mode: "A new member sees only the messages after it joins. It
replies when someone @mentions it." Under the heading "Agents that are not
members", each agent shows its model and its mode, and a checkbox named
"Invite <agent>" or "Add <agent>". The footer counts the picked agents ("1
picked"). Add or Invite sends the picked agents. If the server refuses, an
alert over the list shows the reason and "The agents were not added.", or
"The server did not answer." when no answer came.

Start a chat lists the agents under the heading "Agents", each with a status
dot on its avatar. A refusal in Start a chat or Create a channel shows in the
same alert.
