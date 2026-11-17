# The agent page

`src/pages/agents/[id].tsx` holds the form for a new agent (`/agents/new`) and
for a saved agent (`/agents/:id`).

Both screens show the sidebar (`docs/web-app/sidebar.md`) and the breadcrumb
"Agents / name", where Agents links to `/`. On a saved agent, the row of its
DM in the sidebar is active.

The page is one column of five sections, in the layout of `docs/forms.md`:
Identity, Model and permissions, Folder and limits, Tools, and Instructions.
Then come the Command and, on a saved agent, Delete agent. "On this page" at
the right links to each section and to the Command.

The header:

- **New agent:** a bot icon and "A headless Claude Code agent. Only the name
  is necessary."
- **Saved agent:** its avatar with a status dot, its status Badge, the line
  "Headless Claude Code agent. Runs in 2 channels and 1 group chat.", and
  Stop agent and Restart session while the agent has a process (its state is
  not `exited`). The status and the counts come from `useWorkspace()`, so
  they follow the app stream.

The bar at the foot of the form holds the actions:

- **New agent:** "The agent starts when it gets its first message.", Cancel
  (back to `/`), and Create agent.
- **Saved agent:** "All changes are saved.", or "2 unsaved changes" and "The
  process that runs now keeps the old values.", then Discard and Save agent.
  Discard sets each field back to the saved agent. Save agent stays enabled
  with no change, because a save of an agent in the `default` mode sends
  `manual`.
- After a submit with an error, the status names the fields to fix: "Fix 2
  fields: Name, Maximum turns."

While a save runs, its button says "Creating…" or "Saving…" and is disabled.
Then a toast says "test-runner is created." or "test-runner is saved." A
saved agent then counts no unsaved change.

`src/components/agent-actions/agent-actions.tsx` holds both actions. Each one
asks first in an `AlertDialog`, then sends its route (`docs/server.md`):

- **Stop agent:** "Stop test-runner?", "The next message to test-runner
  starts it again, and it remembers each conversation."
  (`POST /api/agents/:id/stop`).
- **Restart session:** "Restart test-runner?", "test-runner starts again
  with the current configuration, and it remembers each conversation."
  (`POST /api/agents/:id/restart`).

Both dialogs then say that each turn that runs stops, and that a waiting
message gets no reply. While the request runs, the dialog stays open and its
button says "Stopping…" or "Restarting…". Then the dialog closes, and a toast
says "test-runner is stopped." or "test-runner starts again." A refusal shows
an error toast with the title "Stop agent did not work." or "Restart session
did not work.", and the reason.

At the end of the page of a saved agent, a bordered section "Delete agent"
opens the confirm dialog of `docs/delete.md`. After the delete, the page goes
to `/`.

The form sends every field. A new agent goes to `POST /api/agents`, then the
page moves to `/agents/<id>`. A saved agent goes to `PATCH /api/agents/:id`.
The form checks each field with the schema of the server, and shows each
message under its field, in place of the description of that field. The input
names its message with `aria-describedby`. If the server refuses the agent,
the page shows an error toast with the title "The server refused the agent."
and the reason, and each message of the server under its field. See
`docs/forms.md`.

The route keeps one page from `/agents/new` to `/agents/<id>` and back, so
the page starts its form again on each change of the id. `/agents/new` calls
`form.reset()` with the empty agent. A loaded agent goes into state with its
id, and the page calls `form.reset()` with it. The page also gives the loaded
agent to `useForm()` as the default values, because the page renders again
when the workspace loads, and the form then goes back to the default values
of its options. Discard calls `form.reset()`, which goes back to the saved
agent.

A create and a save each send an `agent` event on the app stream
(`docs/server.md`). `useWorkspace()` adds the agent or replaces it, so the
sidebar, Create a channel and Start a chat show the new name at once.

Identity has the name (with `@` before it), the colour and a one-line
Description. The colour is a row of six swatches, and the legend names the
colour that is picked. The description is for the people who read the page.
It does not go into a prompt, and a change to it does not mark a running
session as changed.

The Working directory input has Browse at its end. It opens
`src/components/dialogs/folder/folder-dialog.tsx`, "Pick a folder", at the folder
in the field when that is an absolute path that exists, else at the home
folder (`GET /api/folders`, `docs/server/files.md`). The dialog shows the path in
mono, Up (disabled at `/`), one button for each subfolder, or "No folders in
this folder.", and Cancel and "Use this folder". Browse always puts an
absolute path in the field, because the server does not expand `~` in the
working directory. The field can stay empty. Its description says "Empty: the
agent works in the folder of each channel, or in a scratch folder."
(`docs/agents.md`). Create a channel and Channel settings use the same field
and dialog, in `FolderField` of `src/components/fields/channel/`.

The model uses the Base UI `Select`, with a mono trigger. The permission
mode is a radio group of six cards (`src/components/agent-form/mode-choice.tsx`).
Each card shows the mode in mono and its note, so the user reads each effect
before the pick. The radio takes its name from the mode and its description
from the note. `bypassPermissions` has a "No prompts" badge. A stored mode
that the page does not list checks no card, and a save sends it unchanged.
The modes and their notes are in `docs/agents.md`. The working directory has
a folder icon.

A tool goes into the allowed or the blocked list with Enter or with Add.
Under Allowed tools, "Add a usual tool:" has one button for each of Read,
Edit, Write and `Bash(git status)` that is not in the list ("Allow Read"). A
blocked `ToolSearch` shows its message under Blocked tools at Save, and the
agent is not saved (`docs/forms.md`).

The Command is closed at first. Its summary opens it. It shows the `claude` command of the agent,
with one flag on each line and shell quoting. It follows the form before
Save. It uses `claudeArgs()`, the function that starts the real process
(`docs/agents.md`), with `'<chat plugin>'`, `'<chat server>'`, `'<rule>'` (or
`'<rule> + <system prompt>'`) and `--resume '<session id>'` in place of the
values that the server makes for each session. The line over it says "The app
starts this in <folder> for each conversation.", or "in the folder of each
channel, or in a scratch folder," for a generic agent, because the app starts one
process for each conversation of the agent, not one for each turn. Copy puts
the text on the clipboard.

A change to an agent does not change a process that runs. The next process
uses the new configuration.

Maximum turns is a number input in Folder and limits. An empty field sends
`null`, which means no limit. The limit applies to each message (F36 in
`docs/protocol.md`), and the turn that reaches it ends with "Stopped at the
turn limit" in the thread (`docs/web-app/conversation/timeline.md`). The design shows
30 for a saved agent. A new agent starts with no limit, as before.

"Sleep after (minutes)" is a number input beside Maximum turns. Empty sends
`null`, the app value, and 0 means never. A channel can set its own time in
Channel settings, and that time wins (`docs/sleep.md`).

"Start when the app opens" (`autostart`) is off for a new agent. The design
shows it on. When it is on, the server starts the DM process of the agent at
each server start (`docs/server.md`).
