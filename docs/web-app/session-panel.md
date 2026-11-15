# The session panel and the DM tabs

This page gives the panel on the right of a conversation, and the tabs in
the header of a DM.

## The session panel of a DM

`src/components/conversation/session-panel.tsx` holds the panels on the
right of a conversation, as in the design. In a DM, `SessionPanel` is always
there, with the name "Session" and a visible heading. It has two cards:

- **Session**: Model, Permissions, Directory, Session ID (8 characters, with
  "Copy session ID" for the full ID), Turns and Cost. The values that Claude
  Code reads are mono, and Turns and Cost use tabular numbers.
  `useSessionCard()` (`src/hooks/use-session-card.ts`) loads it from
  `GET …/agents/:agentId/session`, and loads it again when the state of the
  agent changes or a turn or a divider of that agent comes.
- **Allowed tools**: a secondary badge for each rule.

Stop turn shows while the agent works or waits, and stops that agent only.
New session asks first, in an `AlertDialog`: "Start a new session?
test-runner forgets this conversation. The messages stay here.", then three
points: the turn that runs now stops, the new process uses the current
configuration, and a divider marks the new session. When the agent
configuration changed after the process started, a yellow note over the
facts says "The configuration changed. Start a new session to use it."

Below 768 px (`useIsMobile()` in `src/hooks/use-mobile.ts`), the panel is
`SessionSheet`, a `Sheet` from the right (320 px, at most 85 % of the screen).
A "Session" button in the header opens it. The sheet shows the same facts
and actions in one column, then "Allowed tools".

Before the first process of an agent, the server has no session row. The
card then shows the configuration of the agent, "None yet" as the Session
ID, 0 turns and a cost of 0.

## The members of a group chat or a channel

`MembersPanel` is one list of all the members, in place of one panel for each
agent. A secondary button in the header shows the avatars of the agents and
the count of the members ("Members: 1 person, 2 agents" for a screen reader).
It opens the panel, an `aside` named "Members" (360 px), or a `Sheet` below
768 px.

The panel shows "You", then a row for each agent: its avatar with a status
dot, its name, its model, its status Badge and a chevron. The row is a button
with `aria-expanded`. One row opens at a time. The open row shows the session
of that agent, a region named "Session of <agent>": the facts without the
model, Stop turn, New session and Remove. After Remove, the row closes. At the
end, "Invite agents" (a channel) or "Add people or agents" (a group chat)
opens the dialog of `docs/web-app/sidebar.md`.

## A refused action

When the server refuses Stop turn, New session or Remove, an alert shows a
title for the action ("Stop turn did not work.") and the reason. In a DM, it
is at the top of the panel. In a group chat or a channel, it is in the open
row. The alert closes at the next action that works, or with "Close the
alert". Each agent has its own alert, so the reason of one agent does not
show in the session of another.

A new session shows in the timeline as a divider: "New session · 14:03", or
"New session for test-runner · 14:03" when the conversation has more than one
agent.

## The DM tabs

The header of a DM has the tabs of the design: Messages, Files and Session
log. The tab is in the address (`?tab=files`, `?tab=log`), so a reload keeps
it.

Below 768 px, the header has no tabs and no Configure, as the MobileSession
board shows. The Session sheet then ends with a navigation named "Views":
Messages, Files and Session log (the current one has `aria-current="page"`),
and a Configure link. A view changes the address in the same way as a tab,
and closes the sheet.

- **Files** (`files-tab.tsx`) lists each file that the agent read or changed:
  the path without the folder of the session, the last action as a Badge
  ("Read", "Edited" or "Created"), the lines added and removed over all calls
  ("none" for a file that the agent only read), and the time of the last
  call. A heading counts the files, and the table sits in a bordered box that
  scrolls sideways on a narrow screen. `filesOf()` in `src/lib/files.ts` makes the rows from the
  timeline entries, so the tab needs no route. A call that failed does not
  count. A click on a path goes to Messages, and focuses the card of the last
  call on that file.
- **Session log** (`session-log-tab.tsx`) shows each stored line of the
  agent in a bordered box: the time, `in` (yellow) or `out` (blue), and a
  summary such as `system/init` or `control_request can_use_tool`. A click opens the full JSON. A row marks
  the start of each process. `useSessionLog()` opens its own stream for the
  live `line` events, then loads the last 200 lines. "Load earlier lines"
  loads the page before them. A status next to the line over the log, named
  "Stream", says "Live" with a green dot while that stream is open, and
  "Connecting" with a grey dot before it opens and while the browser
  connects it again (`live` of the hook: the route of the open stream, set by `onopen` and cleared by `onerror`).
