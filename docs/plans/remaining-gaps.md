# The remaining gaps

**Status:** in progress. The user agreed the steps and the seams on
2026-11-15, and answered G1 to G7 (see "Resolved"). Step 1 (housekeeping) is
built. Step 2 to step 6 are ahead, in that order.

## The gaps, and what to do with each

| Gap                                                              | Where it is listed              | Action          | Step |
| ---------------------------------------------------------------- | ------------------------------- | --------------- | ---- |
| A refused Stop, Stop turn, New session or Remove shows no reason | `docs/web-app/session-panel.md` | Build           | 2    |
| The session panel does not become a `Sheet` on a narrow screen   | `docs/web-app/session-panel.md` | Build           | 3    |
| The status words differ from the design                          | `docs/web-app/conversation.md`  | Build           | 4    |
| The text of a subagent shows at the top level                    | `docs/timeline.md`              | Measure, build  | 5    |
| Unread rows of the sidebar                                       | `docs/web-app/sidebar.md`       | Build           | 6    |
| A `rate_limit_event` that is not `allowed` is not measured       | `docs/protocol.md`              | Wait for a line | none |
| `set_model` and `set_permission_mode` are not measured           | `docs/protocol.md`              | No action       | none |
| `--max-turns` is not on the command line                         | `docs/agents.md`, `protocol`    | No action       | none |
| Two sessions in the same folder are not measured                 | `docs/protocol.md`              | No action (G7)  | none |
| The cost and the turns of a session are not stored               | `docs/store.md`                 | No action       | none |

**No action, with the reason:**

- **`set_model` and `set_permission_mode`.** A change to an agent reaches
  only its next process, and the card says so. Nothing needs a live change
  now. Measure these lines only if that decision changes.
- **`--max-turns`.** Claude Code 2.1.311 has no such flag. Look again after
  an upgrade of Claude Code.
- **The cost and the turns.** The session card adds them up from the turn
  items. That is fast enough, so a stored copy would only add a second truth.
- **A `rate_limit_event` that is not `allowed`.** A test cannot make one
  without a real limit. The reducer already adds a notice for each status
  other than `allowed`. When a real line comes, record it as a fixture and
  check the names in `docs/protocol.md`.
- **Two sessions in the same folder.** The user chooses the folder of each
  agent. `docs/architecture.md` lists it as a risk.

## Step 2: The reason of a refused action

**Decisions:**

- Stop, Stop turn, New session and Remove each await their request. A
  refusal or a network failure shows an alert with the reason that the
  server gave, or "The server did not answer." when no answer came.
- The alert shows in the place of the action: in the session panel for Stop
  turn, New session and Remove, and over the composer for Stop.
- The alert closes at the next action, or with a Close button.
- No `void` call to an action stays in the page, because a rejected promise
  that nobody awaits is an unhandled error in the browser.
- Start a chat and Create a channel also show "The server did not answer."
  when `fetch` fails. The fake network cannot make `fetch` fail now, so the
  fake gets a way to do that (a responder that throws).

**Seams:** the DM page and the group chat page, with the fake network. For
example: Remove of the last agent of a group chat gets `400 "A group chat
needs one agent or more."`, and the panel shows that text.

## Step 3: The session panel on a narrow screen

**Decisions:**

- Below 768 px, the breakpoint of `src/hooks/use-mobile.ts`, the panel is
  a `Sheet` (`src/components/ui/sheet.tsx`, which the project has) from the
  right, not an `aside`.
- In a DM, a "Session" button in the header opens the sheet. In a group chat
  or a channel, a click on an agent opens it, as the panel does now.
- One part holds the content of the panel, and two wrappers show it: the
  `aside` and the `Sheet`.

**Seams:** the DM page at a narrow width. jsdom has no layout, so the test
sets the media query through `window.matchMedia`, which is a browser
boundary. `useIsMobile()` reads it.

**Check:** `agent-browser` at a phone width, with `pnpm server` and Vite.

## Step 4: The status words of the design

**Decision (G1):** `src/components/conversation/agent-look.ts` changes three
labels:

| State     | Now     | Design         |
| --------- | ------- | -------------- |
| `idle`    | Online  | Idle           |
| `waiting` | Waiting | Needs approval |
| `exited`  | Idle    | Stopped        |

The tests that read these words change with it, because the words are the
behaviour that the user sees. The table in `docs/web-app/conversation.md`
changes too.

**Seams:** the DM page and the sidebar, with the fake network.

## Step 5: The text of a subagent

**Measure first (G3).** Record a fixture, `subagent-text.jsonl`, in which the
subagent writes text before its last answer. The prompt can ask the
subagent to "say what you will read, then read notes.txt". This costs about
0.01 USD. The fixture tells which lines carry the text of a subagent:
`assistant` lines with `parent_tool_use_id`, `stream_event` lines, or both.

**Decision (G2):** the reducer puts `parentToolUseId` on a message, as on a
tool call. The browser shows the text of a subagent inside the card of its
`Agent` call, with its tool calls, in the order that they came. It never
shows at the top level.

**Seams:** `reduceTimeline()` with the new fixture, and the DM page.

## Step 6: Unread rows

This is the largest step, and it changes the schema.

**Decisions (G4, G6):**

- Unread rows only. No mention count, because an agent cannot address the
  user.
- The store keeps, for each conversation, the `seq` that the user saw last.
- A row in the sidebar is bold when the conversation has an item of an agent
  after that `seq`.
- A conversation counts as seen when its page is open and the window has
  the focus. The page then sends the `seq` of its last entry.
- The app stream sends a new event, `unread`, so the sidebar of each window
  follows.

```
conversations                      conversation_reads   NEW (migration v5)
+--------------------+             +-------------------------------+
| id            PK   |──1:1───────▶| conversation_id  PK, FK       |
| kind               |             |   ON DELETE CASCADE           |
| name               |             | last_read_seq    INTEGER      |
| ...                |             | read_at          TEXT         |
+--------------------+             +-------------------------------+
```

A conversation with no row has not been read: each item is unread.

**Data flow:**

```
open page, window focused ─▶ POST /api/conversations/:id/read { seq }
   ─▶ store.markRead(id, seq) ─▶ app stream { type: "unread", conversationId,
      unread: false }
new agent item ─▶ store ─▶ app stream { type: "unread", conversationId,
      unread: true }
GET /api/conversations ─▶ each conversation with { unread }
```

**Seams:** `Store` (`markRead()`, and the `unread` flag of
`listConversations()`), `createServer()` (the route and the `unread` event),
`useWorkspace()`, and the sidebar.

## Not in this plan

- **The flaky server test.** "the user can allow once, deny, or always allow
  a tool, and each card shows the answer" failed one time in a full run on
  2026-11-15, and then passed in more than ten full runs. Its error was not
  kept. If it fails again, keep the output of the run, and use the
  `diagnosing-bugs` skill.

## Resolved

- **G1.** Change the status words to the words of the design? Yes (step 4).
- **G2.** Show the text of a subagent inside its `Agent` card, or hide it?
  Show it inside the card (step 5).
- **G3.** May the next session spend about 0.01 USD to record
  `subagent-text.jsonl`? Yes.
- **G4.** Do you want unread rows and mention counts at all? Unread rows
  only (step 6).
- **G5.** What is a mention of the user? Not needed, because step 6 has no
  mention count.
- **G6.** Should a conversation count as seen when its page is open, or only
  when the user scrolls to its end? When its page is open and the window has
  the focus.
- **G7.** Should the app warn when two agents have the same `cwd`? No. It is
  the choice of the user, and `docs/architecture.md` lists it as a risk.
