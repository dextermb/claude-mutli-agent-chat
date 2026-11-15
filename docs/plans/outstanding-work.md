# The outstanding work of the agent chat app

**Status:** in progress. The user agreed the plan, the order and the seams
on 2026-11-15. Step 1 is built, and its result is in `docs/*.md`. Step 2 is
next. Nothing below is built. The decisions stand as written. Each open
question at the end keeps the decision of its step as the default, until the
user answers it.

## The steps

Do the steps in this order. Each step is one worktree and one branch, and it
merges into `master` before the next step starts.

| Step | Name                           | Items                                                                                                  | Schema       |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------ |
| 1    | Small fixes and message times  | Built                                                                                                  | none         |
| 2    | The stream                     | Subagent lines, rate-limit notice, interrupt during a tool call, two open requests                     | none         |
| 3    | The process                    | Kill a process that does not stop, keep and show stderr                                                | migration v2 |
| 4    | Live status and the event log  | Live status in the sidebar, cut the event log                                                          | none         |
| 5    | The session panel              | Session card, Stop turn, New session, a change reaches the next process, autostart                     | migration v3 |
| 6    | Members                        | Add and remove the members of a conversation                                                           | migration v4 |
| 7    | The Files and Session log tabs | The two tabs of the DM header                                                                          | none         |
| 8    | TanStack Form                  | The agent page and Create a channel on TanStack Form, with validation in the browser and on the server | none         |

Steps 2 and 3 make the session and the reducer correct before step 5 puts a
card on them. Step 4 comes before step 5 because the card follows the live
state. Steps 6 and 7 are independent of each other.

## Findings from the reading

These facts shape the plan. They are not in the docs yet.

- **F-c. `--session-id <uuid>` is in the help of 2.1.311.** "Use a specific
  session ID for the conversation (must be a valid UUID)." So the server can
  choose the Claude session ID of a new session.
- **F-d. `--max-turns` is still not in the help.** The design shows "Turns
  7 of 30". The "of 30" has no flag to come from. `--max-budget-usd` is in the
  help.
- **F-e. No fixture has a `rate_limit` line that is not `allowed`.**
- **F-f. The design does not show the Files tab, the Session log tab, the
  divider, a remove button for a member, or any notice.** The plan proposes
  each one.
- **F-g. The status words of the design differ from the app.** The design
  says "Idle" for `idle`, "Needs approval" for `waiting`, and "Stopped" for
  `exited`. The app says "Online", "Waiting" and "Idle". See Q13.

## Schema changes

The store makes each table with `CREATE TABLE IF NOT EXISTS`. That does not
add a column to a table that exists. So step 3 adds a migration loop.

**Decision: `PRAGMA user_version` and a list of migrations.** The schema of
today is version 1. `openStore()` reads `user_version`, runs each later
migration in one transaction, then sets `user_version`. A new database runs
the full list. Rejected: a check of `PRAGMA table_info` for each column,
because it grows with each column and cannot run data changes.

```
agents                                conversations
+--------------------+                +--------------------+
| id            PK   |                | id            PK   |
| name               |                | kind               |
| colour             |                | name               |
| model              |                | topic              |
| permission_mode    |                | private            |
| cwd                |                | reply_mode         |
| autostart          |                | created_at         |
| allowed_tools      |                +---------+----------+
| disallowed_tools   |                          | 1:N  ON DELETE CASCADE
| system_prompt      |                          v
| created_at         |                conversation_members
+---------+----------+                +----------------------------+
          | 1:N                       | conversation_id  PK, FK    |
          | ON DELETE CASCADE         | member_key       PK        |
          |                           | agent_id         FK  CASCADE
          |                           | position                   |
          |                           | joined_seq   NEW (v4)      |
          |                           +----------------------------+
          v
agent_sessions                                    1:N CASCADE from conversations
+----------------------------+
| id                 PK      |
| agent_id           FK      |
| conversation_id    FK      |
| claude_session_id          |
| state                      |
| started_at                 |
| ended_at          NEW (v2) |
| exit_code         NEW (v2) |
| stderr            NEW (v2) |
| config            NEW (v3) |
+------+---------------+-----+
       | 1:N CASCADE   | 1:N  ON DELETE SET NULL
       v               v
session_events     timeline_items
(no change)        (no new column, two new kinds:
                    session_start and notice)
```

- `agent_sessions.ended_at` (TEXT, null while the process runs): the time of
  the exit.
- `agent_sessions.exit_code` (INTEGER, null): the exit code, or null after a
  signal.
- `agent_sessions.stderr` (TEXT, null): the last 4 KB of stderr.
- `agent_sessions.config` (TEXT, JSON, null for the rows before v3): the
  model, permission mode, folder, tool lists and system prompt that the
  process started with.
- `conversation_members.joined_seq` (INTEGER NOT NULL DEFAULT 0): the `seq`
  when the member joined. The prompt of a new member starts after it.
- `timeline_items.kind` gets two values. `session_start` is the divider of
  New session. `notice` is a rate-limit notice or a failed process.

Migration v2 also runs `rebuildTimeline()` for each session, so the stored
turn items get the per-turn cost that step 1 added to the reducer. See Q1.

## The new routes and events

| Route                                                  | Step | Body            | Result                                       |
| ------------------------------------------------------ | ---- | --------------- | -------------------------------------------- |
| `GET /api/events`                                      | 4    |                 | The app-wide event stream (SSE)              |
| `GET /api/conversations/:id/agents/:agentId/session`   | 5    |                 | `{ session }`, the data of the session card  |
| `POST /api/conversations/:id/agents/:agentId/stop`     | 5    |                 | `202`. Interrupts that one agent             |
| `POST /api/conversations/:id/agents/:agentId/sessions` | 5    |                 | `201 { session }`. New session               |
| `POST /api/conversations/:id/members`                  | 6    | `{ agentIds }`  | `{ conversation }`. `400` for a DM           |
| `DELETE /api/conversations/:id/members/:agentId`       | 6    |                 | `{ conversation }`. `400` for the last agent |
| `GET /api/conversations/:id/agents/:agentId/log`       | 7    | `?before=<seq>` | `{ lines }`, the last 200 lines before `seq` |

| Stream event                              | Stream | Step | When                                         |
| ----------------------------------------- | ------ | ---- | -------------------------------------------- |
| `{ type: "reset" }`                       | both   | 4    | The browser asks for an event that is gone   |
| `{ type: "agent_state", agentId, state }` | app    | 4    | The state of an agent (all its sessions)     |
| `{ type: "conversation", conversation }`  | both   | 4, 6 | A conversation is made or its members change |

---

## Step 2: The stream

### 2.1 Subagent lines inside the Agent card

**Decisions:**

- The reducer puts `parentToolUseId` on each `tool_call` and `message` item.
  The decoder already reads `parent_tool_use_id` (F22).
- The browser shows each item with a `parentToolUseId` inside the card of the
  `Agent` call with that `toolUseId`, as a short list of tool calls. It does
  not show it at the top level.
- The text messages of a subagent are hidden. The result of the `Agent` call
  already carries the summary of the subagent, and a terminal session of
  Claude Code also hides that text. See Q3.
- The `Agent` card shows "3 tool calls" when it is closed, and the list when
  it is open.

**Data flow:** `subagent.jsonl` line → `decodeLine()` (has
`parentToolUseId`) → `reduceTimeline()` puts it on the item → stored payload
→ `Timeline` groups the children under their parent card.

**Seams:**

- `reduceTimeline()` with `subagent.jsonl`: the tool call of the subagent has
  the `parentToolUseId` of the `Agent` call, as the recorded line gives it.
- The DM page: the subagent call shows inside the `Agent` card and not as its
  own block.

### 2.2 A notice for a `rate_limit` line that is not `allowed`

**Decisions:**

- A new item kind, `notice`:
  `{ kind: "notice", id, tone: "warning" | "error", reason: "rate_limit" | "failed", text, detail }`.
- The reducer adds a notice when a `rate_limit` line has a status other than
  `allowed`, and only when the status differs from the status of the last
  `rate_limit` line. So a run of the same status gives one notice.
- `rejected` gives the tone `error`: "The five-hour rate limit is reached.
  It resets at 14:00." Any other status gives the tone `warning`: "The
  five-hour rate limit is near. It resets at 14:00."
- The timeline shows a notice as one line with an icon, in the colours of the
  tone. The design has no notice (F-f).

No fixture has such a line (F-e). The test changes the status of the
recorded line from `question.jsonl` to a literal. The status names
`allowed_warning` and `rejected` come from the Agent SDK types, not from a
measurement. See Q4.

**Seam:** `reduceTimeline()`: the recorded `rate_limit` line with the status
`rejected` adds one notice. A second line with the same status adds nothing.

### 2.3 Measure an interrupt during a tool call

**Decision:** record a new fixture, `interrupt-tool.jsonl`. The prompt makes
the agent run `sleep 30` with Bash, and the recorder sends `interrupt` after
the `tool_use` line. Then compare its `result` line with F10. If the
`terminal_reason` is not `aborted_streaming`, the reducer marks that value
`stopped` too, and the running tool call becomes `error` or `stopped` as the
line tells.

This costs about 0.01 USD. See Q5.

**Seam:** `reduceTimeline()` with `interrupt-tool.jsonl`: the turn is
`stopped`, and the tool call does not stay `running`.

### 2.4 Measure two permission requests that are open at the same time

**Decision:** record `two-requests.jsonl`. The prompt asks for two new files
with two `Write` calls in one message. The recorder answers the second
request first. This tells whether Claude Code sends the second request before
the first answer.

If it does, `AgentSession` keeps a set of open request IDs. An answer echo
removes one ID, and the state becomes `busy` only when the set is empty. Now
the first answer sets `busy` while the second card still waits.

This costs about 0.01 USD. See Q5.

**Seam:** `AgentSession` with the fake `claude` and `two-requests.jsonl`:
after the first answer, the state stays `waiting`. After the second answer,
the state is `busy`.

### Docs when step 2 lands

`docs/protocol.md` (two fixtures, the new findings, the rate-limit statuses),
`docs/timeline.md` (subagent items, notices), `docs/agents.md` (open
requests), `docs/web-app.md` (the Agent card, notices).

---

## Step 3: The process

### 3.1 Kill a process that does not stop

**Decisions:**

- `stop()` closes stdin and waits. After `stopTimeoutMs` (default 5000), it
  sends `SIGTERM`. After `stopTimeoutMs` again, it sends `SIGKILL`.
- An exit after `stop()` is `exited`, also after a signal, because the server
  asked for it. An exit that the server did not ask for keeps the current
  rule: code 0 is `exited`, any other exit is `failed`.
- `server.close()` already awaits `stop()` of each session, so a hung process
  can delay the shutdown by 10 s at most.

**Seam:** `AgentSession` with a new fake mode, `hang`, which ignores the end
of stdin and `SIGTERM`. A test gives `stopTimeoutMs: 50`, calls `stop()`, and
expects the promise to resolve with the state `exited`.

### 3.2 Keep the stderr of a failed process, and show it

**Decisions:**

- `AgentSession` keeps the last 4 KB of stderr in memory. On exit it sends a
  new event: `{ type: "exit", code, signal, stderr }`.
- The server writes `ended_at`, `exit_code` and `stderr` to the session row
  (migration v2).
- When the state is `failed`, the server adds a `notice` item with the tone
  `error`: "test-runner stopped with an error (exit code 1)." The `detail`
  holds the stderr. The item ID is `<session id>/exit`.
- The notice shows the first line of `detail`, with "Show details" to open
  the rest in a `<pre>`.
- The stderr is never sent to an agent in a prompt.

Warning: stderr can hold a secret, for example a token in an error message
of a hook. The server keeps it only in the local database and the local
browser. It is not sent to any other service.

**Data flow:** child stderr → `AgentSession` buffer → `exit` event → server →
`updateSession({ endedAt, exitCode, stderr })` and `saveItems()` with the
notice → `item` event → `Timeline`.

**Seams:**

- `AgentSession`: the fake mode `crash` also writes `FAKE_CLAUDE_STDERR` to
  stderr. A test expects the `exit` event with code 1 and that text.
- `createServer()`: a crash adds a notice with that text, and the session row
  keeps it.
- `Store`: `openStore()` of a file with `user_version` 1 adds the v2 columns
  and keeps the rows. The test writes the version 1 schema as a literal.
- The DM page: a notice shows its text, and "Show details" shows the stderr.

### Docs when step 3 lands

`docs/agents.md` (stop, stderr, the `exit` event, the `hang` mode),
`docs/store.md` (migrations, new columns, "Not stored yet"),
`docs/web-app.md` (the notice).

---

## Step 4: Live status and the event log

### 4.1 Live status in the sidebar

**Decisions:**

- A new app-wide stream, `GET /api/events`. It sends `agent_state` with the
  state of the agent for all its conversations (the same rule as
  `GET /api/agents`), and `conversation` when a conversation is made or its
  members change. Rejected: a poll, because the app already has an event
  stream with replay.
- The server sends `agent_state` on the app stream only when the combined
  state of the agent changes.
- A new hook, `useWorkspace()`, loads `GET /api/conversations` and
  `GET /api/agents`, then follows `/api/events`. The sidebar uses it, so it
  no longer loads the lists again at each page change.
- The sidebar footer shows the design text: "2 agents working · 1 needs
  approval". It shows nothing when no agent works.
- Unread rows and mention counts are in the design, but they are not in this
  plan. See Q6.

**Seams:**

- `createServer()`: a test opens `/api/events`, sends a message to an agent,
  and expects `agent_state` events `starting`, `idle`, `busy`, `idle` for
  that agent.
- `useWorkspace()`, with the fake network: an `agent_state` event changes
  the state of that agent.
- The sidebar, with the fake network: the dot and the screen-reader text of
  an agent change after an event, and the footer counts the agents.

### 4.2 Cut the event log

**Decisions:**

- Each stream keeps the last 500 events. `createServer()` takes
  `eventLogSize`, so a test can give 3.
- When a browser asks for events after an ID that the log no longer holds,
  the server sends `{ type: "reset" }`. The same applies when the ID is
  higher than the last ID, which happens after a server start.
- On `reset`, `useConversation()` and `useWorkspace()` load their data again
  and open the stream from the new `lastEventId`.

This also fixes a gap in `docs/server.md`: after a server start, a browser
that connects again now loads the timeline again.

**Seams:**

- `createServer()` with `eventLogSize: 3`: after 5 events, a stream from
  `lastEventId=1` gets `reset`. A stream from `lastEventId=3` gets events 4
  and 5.
- `useConversation()`, with the fake network: a `reset` event loads the
  timeline again.

### Docs when step 4 lands

`docs/server.md` (the app stream, `reset`, the cap), `docs/web-app.md` (the
sidebar, `useWorkspace()`), `docs/conversations.md` (remove "loads once").

---

## Step 5: The session panel

The design puts the panel on the right side of the DM, about 340 px wide,
with two cards: "Session" and "Allowed tools". On a narrow screen it is a
`Sheet`.

### 5.1 The configuration of each process

**Decision:** the server writes the agent configuration to
`agent_sessions.config` when it starts a process (migration v3). The card
shows this configuration, because it is what the process uses. This closes
the item "a change to an agent reaches only its next process":

- When the agent configuration differs from the configuration of the live
  process, the card shows "The configuration changed. Start a new session to
  use it."
- A live change with `set_model` or `set_permission_mode` is not in this
  plan, because neither line is measured on 2.1.311. See Q7.

### 5.2 The session card

| Label       | Value                                                               |
| ----------- | ------------------------------------------------------------------- |
| Model       | `config.model`                                                      |
| Permissions | `config.permissionMode`                                             |
| Directory   | `config.cwd`, with the home folder as `~`                           |
| Session ID  | The first 8 characters of the Claude session ID, with a copy button |
| Turns       | The sum of `numTurns` of the turn items of this Claude session      |
| Cost        | The sum of `costUsd` of the same turn items, as "$0.18"             |

- "This Claude session" means each session row of this agent in this
  conversation with the same `claude_session_id`. A `--resume` makes a new
  row with the same ID, so the card adds the turns of each row.
- The turns and the cost are derived from the turn items. They are not
  stored.
- The design shows "7 of 30". The plan shows "7", because there is no
  `--max-turns` (F-d). See Q8.
- Stop turn interrupts this one agent and empties its queue. It shows only
  while the agent is `busy` or `waiting`.
- The "Allowed tools" card shows `config.allowedTools` as badges.
- The card loads `GET …/agents/:agentId/session`, and loads it again on each
  `agent_state` event and each `turn` item of that agent.
- In a group chat or a channel, a click on an agent in the header opens the
  same panel for that agent. See Q9.

**Data flow:** `GET …/session` → `latestSession()` → the rows with the same
`claude_session_id` → their turn items → `{ model, permissionMode, cwd,
allowedTools, claudeSessionId, state, turns, costUsd, configChanged }`.

### 5.3 New session (decided by the user)

The agent gets a new Claude session ID and keeps its configuration. The old
timeline stays above a divider.

**Decisions:**

- New session asks first, in an `AlertDialog`: "Start a new session?
  test-runner forgets this conversation. The messages stay here." The design
  has no dialog. See Q10.
- The server empties the queue of the agent, interrupts a turn that runs,
  and stops the process.
- It makes a new session row with a new UUID as `claude_session_id`, and
  starts a process with `--session-id <uuid>` in place of `--resume` (F-c).
  So the card shows the new ID at once, and the next message resumes it.
  `buildArgs()` uses `--session-id` for a new ID and `--resume` for a known
  one, so the session row gets a flag for "new". The live check of this step
  measures that `system/init` gives the same ID (Q5).
- It adds a `session_start` item, authored by the agent, at the next `seq`:
  `{ kind: "session_start", id, claudeSessionId }`. The timeline shows it as
  a divider: "New session · 14:03". In a group chat or a channel: "New
  session for test-runner · 14:03".
- In a group chat or a channel, the prompt cursor of the agent moves to the
  `seq` of the divider. So the first prompt of the new session holds only the
  messages after the divider. After a server start, the fallback (the last
  item of the agent) gives the same place, because the divider is an item of
  the agent.

**Data flow:** New session → `POST …/agents/:agentId/sessions` → stop the
live process → `createSession({ claudeSessionId: uuid, fresh: true, config })`
→ `saveItems()` with the divider → `item` event → start the process →
`agent_state` events → the card loads again.

### 5.4 Autostart

**Decisions:**

- When the server starts, it starts a process for each agent with
  `autostart` that has a DM. The process resumes the latest session of that
  DM. It does not send a prompt, so it costs nothing (F25). But the
  `SessionStart` hooks of the user run (F23).
- The server does not make a DM for an autostart agent that has none. See
  Q11.
- `createServer()` gets a `start()` method that does this, and
  `server/main.ts` calls it after `listen()`. A test can then check the
  behaviour without a real start of the server.
- The form keeps `autostart` off by default. The design shows it on. See Q11.

### Seams of step 5

- `buildArgs()`: a session row with a new ID gives `--session-id <id>` and no
  `--resume`.
- `Store`: migration v3, and the rows of one Claude session give the sum of
  their turns and costs.
- `createServer()`:
  - `GET …/session` gives the values of the card. The expected cost is the
    sum of the turn costs of the fixture, as a literal.
  - `POST …/sessions` stops the old fake process, adds a divider, and starts
    a process with `--session-id`.
  - After New session, the prompt in a group chat holds only the messages
    after the divider.
  - `POST …/agents/:agentId/stop` interrupts that agent and not the other
    agent.
  - `start()` starts the DM process of an autostart agent, and the fake
    `claude` gets `initialize` but no prompt.
- The DM page, with the fake network:
  - The card shows the six labels and their values.
  - New session asks first, and then sends the POST.
  - The divider shows "New session · 14:03".
  - "The configuration changed …" shows when the agent differs.
- The live check (`pnpm test:live`): a new session with `--session-id` gives
  that ID in `system/init`, and a second process resumes it. About 0.02 USD.

### Docs when step 5 lands

`docs/agents.md` (`--session-id`, `config`), `docs/store.md` (v3, the card
query), `docs/server.md` (three routes, autostart), `docs/conversations.md`
(the prompt after New session), `docs/web-app.md` (the panel, the divider),
`docs/protocol.md` (the `--session-id` finding).

---

## Step 6: Members

**Decisions:**

- `POST /api/conversations/:id/members { agentIds }` adds agents to a group
  chat or a channel. `DELETE /api/conversations/:id/members/:agentId`
  removes one. A DM refuses both with `400`, because a DM has one agent.
- The last agent of a group chat cannot go: `400` "A group chat needs one
  agent or more." A channel can have no agents.
- A group chat has the names of its agents as its name. A change of members
  changes the name too. A channel keeps its name.
- A remove stops the live process of that agent in that conversation and
  empties its queue. The items of that agent stay in the timeline.
- `conversation_members.joined_seq` (migration v4) holds the `seq` when the
  agent joined. The first prompt of a new member holds only the messages
  after that `seq`. See Q12.
- A member that joins again gets a new `joined_seq`. Its old session rows
  stay, so its next process resumes the old Claude session. See Q12.
- Both routes send `{ type: "conversation", conversation }` on the stream of
  the conversation and on the app stream.

**The UI:**

- The group chat header gets "Add people or agents", and the channel header
  gets "Invite agents", as in the design. Each opens a dialog that lists the
  agents that are not members, with checkboxes, the model and the mode, as
  in Create a channel.
- The design has no remove button (F-f). The avatar group in the header
  opens a "Members" popover. Each agent row has a "Remove" button. The user
  row has none.

**Data flow:** the dialog → `POST …/members` → `addMember()` with
`joined_seq = nextSeq() - 1` → `conversation` event → `useConversation()`
replaces the conversation and loads the agents again.

**Seams:**

- `Store`: `addMember()` and `removeMember()` keep the order of `position`.
- `createServer()`:
  - add an agent to a group chat, mention it, and expect a prompt with only
    the messages after the join,
  - remove a busy agent, and expect its fake process to stop,
  - a DM refuses both routes.
- The group chat page, with the fake network: the dialog sends the picked
  agents, and Remove sends the DELETE.

### Docs when step 6 lands

`docs/server.md`, `docs/conversations.md` (members, the prompt of a new
member), `docs/store.md` (v4), `docs/web-app.md` (the dialog and the
popover).

---

## Step 7: The Files and Session log tabs

The design names the tabs "Messages", "Files" and "Session log" in the DM
header, but it shows no content for the two new tabs (F-f). The tab state is
in the URL (`?tab=files`), so a reload keeps it.

### 7.1 Files

**Decision:** the Files tab lists each file that the agent read or changed
in this conversation. It is derived in the browser from the `tool_call`
entries that it already holds. It needs no route.

| Column  | From                                                           |
| ------- | -------------------------------------------------------------- |
| File    | `input.file_path`, without the folder of the agent             |
| Last    | "Read", "Edited" or "Created", from the last call on that file |
| Changes | The sum of `+` and `−` of each `diff` result, as "+6 −2"       |
| Time    | `createdAt` of the last call, as `HH:MM`                       |

- The tools are `Read`, `Edit`, `MultiEdit`, `Write` and `NotebookEdit`.
  Bash commands are not files.
- The rows are in the order of the last call, the newest first.
- A click on a row goes to the Messages tab and scrolls to that tool card.
- The empty state: "test-runner has not opened a file in this conversation."

**Seams:**

- `filesOf(entries, cwd)`, a pure function: the tool calls of
  `tools.jsonl` give the rows, with the values of the recorded lines.
- The DM page: the Files tab shows those rows.

### 7.2 Session log

**Decision:** the Session log tab shows the raw lines of `session_events` of
this agent in this conversation, the newest last.

- Each row shows the time (`HH:MM:SS`), the direction ("in" or "out"), and a
  summary: the `type` and `subtype` of the line, for example
  `system/init` or `control_request can_use_tool`. A click opens the full
  JSON.
- A row marks the start of each process: "Process started · resumed
  4f1c9a2e".
- The route gives the last 200 lines. "Load earlier lines" asks with
  `?before=<seq>`.
- The tab follows new lines with a new `line` event on the stream of the
  conversation. See Q14.

Warning: the raw lines hold the full tool output, which can hold a secret
from a file that the agent read. The log is local to this machine, as the
store is.

**Seams:**

- `Store`: `listAgentLines(agentId, conversationId, { before, limit })`
  gives the lines of all sessions of that agent, in order.
- `createServer()`: `GET …/log` gives the lines that the fake `claude`
  wrote, and `before` gives the earlier page.
- The DM page: the Session log tab shows a row with `system/init`.

### Docs when step 7 lands

`docs/server.md` (the route, the `line` event), `docs/store.md`,
`docs/web-app.md` (the tabs).

---

## Resolved

- **Q2 (2026-11-15).** Step 1 shipped the day headings in each kind of
  conversation, as the plan proposed. The user can still ask for a change.
- **Q5 (2026-11-15).** The user agreed to spend about 0.04 USD on three real
  `claude` runs with Haiku: the two fixtures of step 2 (about 0.01 USD each)
  and the live check of `--session-id` in step 5 (about 0.02 USD).

## Step 8: TanStack Form

The user asked for this step on 2026-11-15, after step 1. It comes after
step 7. It needs its own short plan, agreed with the user, before it starts.

What is decided:

- The agent page and the Create a channel dialog move from a `useState`
  draft to TanStack Form.
- The browser validates each field, and the server keeps its own
  validation. Both apply.

What is still open: the schema library (for example Zod, through Standard
Schema), and whether the browser and the server share one schema.

## Open questions

- **Q1.** Migration v2 rebuilds each stored timeline, so old turn items get
  the correct cost. Is a rebuild of the whole database at the first start
  acceptable? The alternative: keep the old costs as they are.
- **Q3.** Hide the text messages of a subagent, and show only its tool
  calls? Or show its text inside the card too?
- **Q4.** The rate-limit notice uses status names from the SDK types, not
  from a recorded line. Is that acceptable until a real line is seen?
- **Q6.** Unread rows and mention counts in the sidebar are in the design.
  Add them as a later step, or leave them out?
- **Q7.** A change to the model or the mode reaches only the next process.
  Is the notice in the card enough? Or do you want a live change with
  `set_model`, which needs a measurement first?
- **Q8.** The design shows "Turns 7 of 30". There is no `--max-turns` on
  2.1.311. Show "7" only? Or use `--max-budget-usd` and show "Cost $0.18 of
  $1.00", with a budget field on the agent?
- **Q9.** The session panel in a group chat or a channel: open it with a
  click on an agent in the header? Or keep the panel to the DM only?
- **Q10.** Ask before New session? The design shows no dialog.
- **Q11.** Autostart: start only the DM process? Make a DM when the agent
  has none? And should the switch be on for a new agent, as in the design?
- **Q12.** A new member sees only the messages after it joins. Should it get
  a short history instead, for example the last 20 messages? And should a
  member that joins again resume its old Claude session, or start a new one?
- **Q13.** The status words of the design differ from the app (F-g). Change
  the app to the design words ("Idle", "Needs approval", "Stopped")?
- **Q14.** Should the Session log follow new lines live, or load them with
  a Refresh button? A live log adds a `line` event for each line of each
  agent to the stream of the conversation.
