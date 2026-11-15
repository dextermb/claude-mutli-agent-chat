# The outstanding work of the agent chat app

**Status:** in progress. The user agreed the plan, the order and the seams
on 2026-11-15. Steps 1 to 6 are built, and their result is in `docs/*.md`.
Step 7 is next. Nothing below is built. The decisions stand as written. Each
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
| 6    | Members                        | Built                                                                                                  | migration v4 |
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

## The new routes and events

| Route                                            | Step | Body            | Result                                       |
| ------------------------------------------------ | ---- | --------------- | -------------------------------------------- |
| `GET /api/conversations/:id/agents/:agentId/log` | 7    | `?before=<seq>` | `{ lines }`, the last 200 lines before `seq` |

Step 7 may add a `line` event to the stream of a conversation, if the
Session log follows new lines live (Q14).

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

- **Q12 (2026-11-15).** Step 6 shipped the default: a new member sees only
  the messages after it joins, and an agent that joins again resumes its old
  Claude session. One change from the plan: "Remove from conversation" is in
  the session panel of the agent, not in a "Members" popover, because each
  agent in the header already opens its panel.

## Open questions

- **Q3.** Hide the text messages of a subagent, and show only its tool
  calls? Or show its text inside the card too?
- **Q4.** The rate-limit notice uses status names from the SDK types, not
  from a recorded line. Is that acceptable until a real line is seen?
- **Q6.** Unread rows and mention counts in the sidebar are in the design.
  Add them as a later step, or leave them out?
- **Q13.** The status words of the design differ from the app (F-g). Change
  the app to the design words ("Idle", "Needs approval", "Stopped")?
- **Q14.** Should the Session log follow new lines live, or load them with
  a Refresh button? A live log adds a `line` event for each line of each
  agent to the stream of the conversation.
