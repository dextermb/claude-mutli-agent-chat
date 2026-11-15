# The agent page

`src/pages/agents/[id].tsx` holds the form for a new agent (`/agents/new`) and
for a saved agent (`/agents/:id`).

Both screens show the sidebar (`docs/web-app/sidebar.md`) and the breadcrumb
"Agents / name", where Agents links to `/`. On a saved agent, the row of its
DM in the sidebar is active.

The header:

- **New agent:** a bot icon, "The agent starts when it gets its first
  message.", Cancel (back to `/`), and Create agent.
- **Saved agent:** its avatar with a status dot, its status Badge, the line
  "Headless Claude Code agent. Runs in 2 channels and 1 group chat.", Stop
  agent and Restart session while the agent has a process (its state is not
  `exited`), and Save agent. The status and the counts come from `useWorkspace()`, so they follow
  the app stream.

`src/components/agent-form/agent-actions.tsx` holds both actions. Each one
asks first in an `AlertDialog`, then sends its route (`docs/server.md`):

- **Stop agent:** "Stop test-runner?", "The next message to test-runner
  starts it again, and it remembers each conversation."
  (`POST /api/agents/:id/stop`).
- **Restart session:** "Restart test-runner?", "test-runner starts again
  with the current configuration, and it remembers each conversation."
  (`POST /api/agents/:id/restart`).

Both dialogs then say that each turn that runs stops, and that a waiting
message gets no reply. A refusal shows an alert with the title "Stop agent
did not work." or "Restart session did not work.", and the reason.

The form sends every field. A new agent goes to `POST /api/agents`, then the
page moves to `/agents/<id>`. A saved agent goes to `PATCH /api/agents/:id`.
The form checks each field with the schema of the server, and shows each
message under its field, in place of the description of that field. The input
names its message with `aria-describedby`. If the server refuses the agent,
the page shows an alert with the title "The server refused the agent." and the
reason, and each message of the server under its field. See `docs/forms.md`.

The page keeps a loaded agent in state and gives it to `useForm()` as the
default values. A call to `form.reset()` is not enough: the page renders again
when the workspace loads, and the form then goes back to the default values
of its options, because the user has not changed a field yet.

The Identity card has the name, the colour and a one-line Description. The
description is for the people who read the page. It does not go into a
prompt, and a change to it does not mark a running session as changed.

The model and the permission mode use the Base UI `Select`, with a mono
trigger, as the design shows. The description under the permission mode
changes with the mode. The working directory has a folder icon. A tool goes
into the allowed or the blocked list with Enter or with Add.

Under the cards, the Command section shows the `claude` command of the agent,
with one flag on each line and shell quoting. It follows the form before
Save. It uses `claudeArgs()`, the function that starts the real process
(`docs/agents.md`), with `'<chat plugin>'`, `'<chat server>'`, `'<rule>'` (or
`'<rule> + <system prompt>'`) and `--resume '<session id>'` in place of the
values that the server makes for each session. The line over it says "The app
starts this in <folder> for each conversation.", because the app starts one
process for each conversation of the agent, not one for each turn. Copy puts
the text on the clipboard.

A change to an agent does not change a process that runs. The next process
uses the new configuration.

Maximum turns is a number input in the Runtime card. An empty field sends
`null`, which means no limit. The limit applies to each message (F36 in
`docs/protocol.md`), and the turn that reaches it ends with "Stopped at the
turn limit" in the thread (`docs/web-app/conversation.md`). The design shows
30 for a saved agent. A new agent starts with no limit, as before.

"Start when the app opens" (`autostart`) is off for a new agent. The design
shows it on. When it is on, the server starts the DM process of the agent at
each server start (`docs/server.md`).
