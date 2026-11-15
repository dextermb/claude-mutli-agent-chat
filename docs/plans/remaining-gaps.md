# The remaining gaps

**Status:** in progress. The user agreed the steps and the seams of step 1
to step 6 on 2026-11-15, and answered G1 to G9 (see "Resolved"). Step 1 to
step 4, step 6 and step 7 are built. Step 5 is closed: Claude Code sends no
text of a subagent (F32 in `docs/protocol.md`), so the reducer needs no
change. Step 8 is ahead, and the user agreed its seams.

## The gaps, and what to do with each

| Gap                                                        | Where it is listed              | Action          | Step |
| ---------------------------------------------------------- | ------------------------------- | --------------- | ---- |
| A `rate_limit_event` that is not `allowed` is not measured | `docs/protocol.md`              | Wait for a line | none |
| `set_model` and `set_permission_mode` are not measured     | `docs/protocol.md`              | No action       | none |
| `--max-turns` is not on the command line                   | `docs/agents.md`, `protocol`    | No action       | none |
| Two sessions in the same folder are not measured           | `docs/protocol.md`              | No action (G7)  | none |
| The cost and the turns of a session are not stored         | `docs/store.md`                 | No action       | none |
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

## Step 8: The Session card before the first process

**Decision (G9):** when an agent has no session in a conversation,
`GET …/agents/:agentId/session` answers with a card made from the agent: its
model, its permission mode, its folder and its allowed tools, with 0 turns,
a cost of 0, and no session ID ("None yet").

**Seams (agreed):** `createServer()` (the route), and the DM page with the
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
  Show it inside the card. Not needed, because Claude Code sends no such
  text (F32).
- **G3.** May the next session spend about 0.01 USD to record
  `subagent-text.jsonl`? Yes. Two recordings cost 0.0147 and 0.0133 USD. The user
  agreed to the second one.
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
