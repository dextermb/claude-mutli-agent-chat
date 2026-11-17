# The message box

This page gives the message box of a DM and of a group chat or a channel,
and the `@` list of agents. The files of the message box are in
`docs/web-app/files.md`.

## A DM

The message box of a DM shows the model of the agent, as a link to
`/agents/:id` named "Model: claude-sonnet-5-5". A change of model is a change
of the agent, so the message box does not change it. After the first turn, it
also shows "31% context". A HoverCard on it shows a Progress named "Context"
and the count: "62,400 / 200,000 tokens". The value comes from the session
card (`docs/web-app/session-panel.md`). The attach and Send buttons are round.

## A group chat or a channel

The message box of a channel is "Message #<name>".

After `@`, the message box shows the agents of the conversation whose
username or display name starts with the typed text, in a list named
"Members". Each option shows the avatar of the agent, its display name, its
`@username` if it has a display name, and its status Badge. A screen reader
hears "test-runner Idle", or "Test Runner @test-runner Idle". The hint under the box shows a `Kbd`: "Enter to send", or
"Tab to pick" while the list is open. Down and Up move the active name, and wrap at
the ends. Tab or Enter picks the active name, and a click picks any one.
Escape closes the list until the text changes. The pick puts `@<username> ` in
the place of the typed text. The message box names the active option with
`aria-activedescendant`.
