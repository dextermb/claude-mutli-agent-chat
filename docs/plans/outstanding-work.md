# The outstanding work of the agent chat app

**Status:** in progress. The user agreed the plan, the order and the seams
on 2026-11-15. Steps 1 to 5 are built, and their result is in `docs/*.md`.
Step 6 is next. Nothing below is built. The decisions stand as written. Each
open question at the end keeps the decision of its step as the default,
until the user answers it.

## The steps

Do the steps in this order. Each step is one worktree and one branch, and it
merges into `master` before the next step starts.

| Step | Name                           | Items                                                                                                  | Schema       |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------ |
| 1    | Small fixes and message times  | Built                                                                                                  | none         |
| 2    | The stream                     | Built                                                                                                  | none         |
| 3    | The process                    | Built                                                                                                  | migration v2 |
| 4    | Live status and the event log  | Built                                                                                                  | none         |
| 5    | The session panel              | Built                                                                                                  | migration v3 |
| 6    | Members                        | Add and remove the members of a conversation                                                           | migration v4 |
| 7    | The Files and Session log tabs | The two tabs of the DM header                                                                          | none         |
| 8    | TanStack Form                  | The agent page and Create a channel on TanStack Form, with validation in the browser and on the server | none         |

Steps 2 and 3 make the session and the reducer correct before step 5 puts a
card on them. Step 4 comes before step 5 because the card follows the live
state. Steps 6 and 7 are independent of each other.

## Findings from the reading

These facts shape the plan. They are not in the docs yet.

- **F-f. The design does not show the Files tab, the Session log tab, the
  divider, a remove button for a member, or any notice.** The plan proposes
  each one.
- **F-g. The status words of the design differ from the app.** The design
  says "Idle" for `idle`, "Needs approval" for `waiting`, and "Stopped" for
  `exited`. The app says "Online", "Waiting" and "Idle". See Q13.

## Schema changes

Step 3 built the migration loop and version 2, and step 5 built version 3
(`docs/store.md`). Step 6 adds version 4 to `MIGRATIONS`. Rejected for the loop: a check
of `PRAGMA table_info` for each column, because it grows with each column
and cannot run data changes.

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
| ended_at          (v2)     |
| exit_code         (v2)     |
| stderr            (v2)     |
| config            (v3)     |
| claude_session_new (v3)    |
+------+---------------+-----+
       | 1:N CASCADE   | 1:N  ON DELETE SET NULL
       v               v
session_events     timeline_items
(no change)        (no new column, a new kind:
                    session_start)
```

- `conversation_members.joined_seq` (INTEGER NOT NULL DEFAULT 0): the `seq`
  when the member joined. The prompt of a new member starts after it.
- `timeline_items.kind` gets `session_start`, the divider of New session.

## The new routes and events

| Route                                            | Step | Body            | Result                                       |
| ------------------------------------------------ | ---- | --------------- | -------------------------------------------- |
| `POST /api/conversations/:id/members`            | 6    | `{ agentIds }`  | `{ conversation }`. `400` for a DM           |
| `DELETE /api/conversations/:id/members/:agentId` | 6    |                 | `{ conversation }`. `400` for the last agent |
| `GET /api/conversations/:id/agents/:agentId/log` | 7    | `?before=<seq>` | `{ lines }`, the last 200 lines before `seq` |

| Stream event                             | Stream | Step | When                                                                                           |
| ---------------------------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------- |
| `{ type: "conversation", conversation }` | both   | 6    | The members of a conversation change. Step 4 sends it on the app stream for a new conversation |

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

## Resolved

- **Q2 (2026-11-15).** Step 1 shipped the day headings in each kind of
  conversation, as the plan proposed. The user can still ask for a change.
- **Q5 (2026-11-15).** The user agreed to spend about 0.04 USD on three real
  `claude` runs with Haiku: the two fixtures of step 2 (about 0.01 USD each)
  and the live check of `--session-id` in step 5 (about 0.02 USD).

- **Q15 (2026-11-15).** The user agreed one more recording for slice 2.3.
  The three recordings of step 2 cost 0.0209 USD in total. The live check
  of step 5 (about 0.02 USD) is still ahead.

- **Q1 (2026-11-15).** Step 3 shipped migration v2 with a rebuild of each
  stored timeline, as the plan proposed. The user can still ask for a
  change.

- **Q7 to Q11 (2026-11-15).** Step 5 shipped the defaults, as the user
  asked: a notice in the card for a changed configuration (no `set_model`),
  "Turns 7" with no limit, the panel in a group chat on a click of an agent,
  a dialog before New session, and autostart of the DM process only, with
  the switch off for a new agent. The measurements of `--session-id` (F29 to
  F31 in `docs/protocol.md`) added the `claude_session_new` column. Step 5
  spent about 0.018 USD on real `claude` runs.

## Open questions

- **Q3.** Hide the text messages of a subagent, and show only its tool
  calls? Or show its text inside the card too?
- **Q4.** The rate-limit notice uses status names from the SDK types, not
  from a recorded line. Is that acceptable until a real line is seen?
- **Q6.** Unread rows and mention counts in the sidebar are in the design.
  Add them as a later step, or leave them out?
- **Q12.** A new member sees only the messages after it joins. Should it get
  a short history instead, for example the last 20 messages? And should a
  member that joins again resume its old Claude session, or start a new one?
- **Q13.** The status words of the design differ from the app (F-g). Change
  the app to the design words ("Idle", "Needs approval", "Stopped")?
- **Q14.** Should the Session log follow new lines live, or load them with
  a Refresh button? A live log adds a `line` event for each line of each
  agent to the stream of the conversation.
