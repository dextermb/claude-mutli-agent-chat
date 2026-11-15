# The remaining gaps

**Status:** in progress. The user agreed the steps and the seams of step 1
to step 6 on 2026-11-15, and answered G1 to G9 (see "Resolved"). Step 1 to
step 4 are built. Step 5 to step 8 are ahead, in that order. The seams of
step 7 and step 8 are proposed, and need the agreement of the user.

## The gaps, and what to do with each

| Gap                                                        | Where it is listed              | Action          | Step |
| ---------------------------------------------------------- | ------------------------------- | --------------- | ---- |
| The text of a subagent shows at the top level              | `docs/timeline.md`              | Measure, build  | 5    |
| Unread rows of the sidebar                                 | `docs/web-app/sidebar.md`       | Build           | 6    |
| A `rate_limit_event` that is not `allowed` is not measured | `docs/protocol.md`              | Wait for a line | none |
| `set_model` and `set_permission_mode` are not measured     | `docs/protocol.md`              | No action       | none |
| `--max-turns` is not on the command line                   | `docs/agents.md`, `protocol`    | No action       | none |
| Two sessions in the same folder are not measured           | `docs/protocol.md`              | No action (G7)  | none |
| The cost and the turns of a session are not stored         | `docs/store.md`                 | No action       | none |
| The sidebar stays open at full width on a narrow screen    | `docs/web-app/sidebar.md`       | Build           | 7    |
| The Session card is empty before the first process         | `docs/web-app/session-panel.md` | Build           | 8    |

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

## Step 7: The sidebar on a narrow screen

**Decision (G8):** below 768 px, the app sidebar is a `Sheet` from the left,
not a column. A menu button, "Open the sidebar", in the header of each page
opens it. A click on a conversation in the sheet closes it.

**Seams (proposed):** the DM page and the home page at a narrow width, with
`screenWidth(375)` and the fake network.

**Check:** `agent-browser` at 375 px.

## Step 8: The Session card before the first process

**Decision (G9):** when an agent has no session in a conversation,
`GET …/agents/:agentId/session` answers with a card made from the agent: its
model, its permission mode, its folder and its allowed tools, with 0 turns,
a cost of 0, and no session ID ("None yet").

**Seams (proposed):** `createServer()` (the route), and the DM page with the
fake network.

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
- **G8.** On a phone, should the sidebar become a `Sheet`? Yes, behind a menu
  button in the header (step 7).
- **G9.** Before the first process, should the Session card show the
  configuration of the agent? Yes (step 8).
