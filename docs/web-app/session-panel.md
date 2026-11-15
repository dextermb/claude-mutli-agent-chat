# The session panel and the DM tabs

This page gives the panel on the right of a conversation, and the tabs in
the header of a DM.

## The session panel

`src/components/conversation/session-panel.tsx` is the panel on the right of
a conversation, as in the design. It has two cards:

- **Session**: Model, Permissions, Directory, Session ID (8 characters, with
  "Copy session ID" for the full ID), Turns and Cost. `useSessionCard()`
  (`src/hooks/use-session-card.ts`) loads it from
  `GET …/agents/:agentId/session`, and loads it again when the state of the
  agent changes or a turn or a divider of that agent comes.
- **Allowed tools**: a badge for each rule.

Stop turn shows while the agent works or waits, and stops that agent only.
New session asks first: "Start a new session? test-runner forgets this
conversation. The messages stay here." When the agent configuration changed
after the process started, the card says "The configuration changed. Start a
new session to use it."

In a DM, the panel is always there, with the name "Session". In a group chat
or a channel, each agent in the header is a button that opens the panel of
that agent, with the name "Session of <agent>" and a Close button.

Below 768 px (`useIsMobile()` in `src/hooks/use-mobile.ts`), the panel is a
`Sheet` from the right, not an `aside`. In a DM, a "Session" button in the
header opens it. In a group chat or a channel, a click on an agent opens it.
The Close button of the sheet closes it. `SessionPanel` and `SessionSheet`
are the two wrappers, and both show the same content.

In a group chat or a channel, the panel also has "Remove from conversation".
After Remove, the panel closes.

When the server refuses Stop turn, New session or Remove, an alert in the
panel shows the reason, and the panel stays open. The alert closes at the
next action that works, or with its Close button. Each agent has its own
alert, so the reason of one agent does not show in the panel of another.

A new session shows in the timeline as a divider: "New session · 14:03", or
"New session for test-runner · 14:03" when the conversation has more than one
agent.

## The DM tabs

The header of a DM has the tabs of the design: Messages, Files and Session
log. The tab is in the address (`?tab=files`, `?tab=log`), so a reload keeps
it.

- **Files** (`files-tab.tsx`) lists each file that the agent read or changed:
  the path without the folder of the agent, the last action ("Read", "Edited"
  or "Created"), the lines added and removed over all calls, and the time of
  the last call. `filesOf()` in `src/lib/files.ts` makes the rows from the
  timeline entries, so the tab needs no route. A call that failed does not
  count. A click on a path goes to Messages, and focuses the card of the last
  call on that file.
- **Session log** (`session-log-tab.tsx`) shows each stored line of the
  agent: the time, `in` or `out`, and a summary such as `system/init` or
  `control_request can_use_tool`. A click opens the full JSON. A row marks
  the start of each process. `useSessionLog()` opens its own stream for the
  live `line` events, then loads the last 200 lines. "Load earlier lines"
  loads the page before them.

## Not built yet

- Before the first process of an agent, the server has no session, and
  `GET …/session` answers `{ "session": null }`. The Session card then shows
  no rows: no model, no mode and no folder.
