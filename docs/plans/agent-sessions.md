# Headless agent sessions in the web app

**Status:** in progress. The eight steps of the build are done. The parts and
the decisions that shipped are in `docs/architecture.md` and the pages that
it names. This plan holds only the work that is still ahead. Nothing below is
agreed for a build yet.

## Still ahead

### From the design

- **New session (D17, decided by the user).** The agent gets a new Claude
  session ID and keeps its configuration. The old timeline stays visible
  above a divider.
- **The session card.** Model, permission mode, folder, Claude session ID,
  turns and cost of the session, with Stop turn and New session.
- **Members.** Add and remove the members of a conversation.
- **The Files and Session log tabs** of the DM header.
- **The time of each message.**
- **Live status in the sidebar.** It loads the agent states once.
- **Start when the app opens.** The `autostart` field is stored, but the
  server does not use it.

### From the timeline (`docs/timeline.md`)

- Show the lines of a subagent inside its `Agent` card.
- A notice for a `rate_limit` line that is not `allowed`.
- Measure an interrupt during a tool call. Only `aborted_streaming` gives
  `stopped` now.

### From the session (`docs/agents.md`)

- Kill a process that does not stop after `stop()`.
- Measure two permission requests that are open at the same time.
- Keep the stderr of a failed process, and show it.
- A change to an agent reaches only its next process.

### From the server (`docs/server.md`)

- Cut the event log of a conversation while the server runs.
- Refuse an empty message.
- Arrow keys in the mention list of the message box.
