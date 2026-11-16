# Build the timeline with the shadcn AI Elements

**Status:** in progress. The user gave the go-ahead on 2026-11-16 with the
proposal of each open question (see Resolved).

Sources:

- Boards: the "AI Elements" page of the "Agent Chat" canvas
  (https://claude.ai/artifact/NyiP26udWrUFSDDX6BjutT). The four boards are
  "DM with an agent", "Channel with agents", "Subagent, error and approval"
  and "Empty DM with suggestions".
- Design system: "Gruvbox Chat"
  (https://claude.ai/artifact/3cUXEWP7TNyCWaxnSe8fYu). Its guidelines for
  Bubble, Trace, CodeBlock, HoverCard and Progress give the colour rules.
- The current behaviour: `docs/web-app/conversation.md` and
  `docs/timeline.md`.

## What changes for the user

| Now                                                             | After                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Each block has an avatar column at the left, also for "You"     | Your message is a muted Bubble at the right, with the time under it, and no avatar                  |
| An agent block has the avatar column                            | An agent block has a header row (small avatar, name, "Agent", time), and the content at full width  |
| A tool call is a mono card on `rail` with a status dot          | A tool call is one Trace line: icon, verb and target, then a description (`84 lines`, `+6 −2`)      |
| The output or error is in the card, always open                 | The output or error is in a CodeBlock behind the line. It opens by itself for an error              |
| A subagent card has a ghost button "3 tool calls"               | A subagent is a Trace group. Its calls are a nested Trace                                           |
| The approval is a strip at the foot of the card                 | The approval is an outline Item under its line: the question, the reason, Deny, Allow once, Always allow |
| The message box has a square Send button                        | Round attach and Send buttons. In a DM, the context figure, with a HoverCard and a Progress bar     |

The working line, the day heading, the session divider, the question card,
the turn summary and the rate-limit notice stay as they are.

## Decisions

1. **One user.** The app has one user, "You" (people are dropped in
   `docs/plans/design-boards.md`). So the secondary Bubble of another person
   on the channel board does not apply. Each human message is your own: a
   muted Bubble with `align="end"`.
2. **An agent keeps its avatar and name.** A channel holds more than one
   agent. So an agent turn has no Bubble, but it has a header row.
3. **One Trace for a run of calls.** Calls that follow each other in one
   block go in one `Trace`, so the gap between lines is the gap of the Trace.
   A message or a card between two calls ends the run.
4. **The words of a line.** The verb follows the tool and its status:

   | Tool         | Running          | Done            | Description          |
   | ------------ | ---------------- | --------------- | -------------------- |
   | Read         | Reading `path`   | Read `path`     | `84 lines`           |
   | Edit         | Editing `path`   | Edited `path`   | `+6 −2`              |
   | Write        | Writing `path`   | Wrote `path`    | `+28`                |
   | Bash         | Running `cmd`    | Ran `cmd`       | `exit 127` on error  |
   | Agent        | Running the subagent: task | Ran the subagent: task | the count of calls |
   | WebFetch     | Fetching `url`   | Fetched `url`   |                      |
   | Another tool | the tool name and its main input (`mainInput()`)  |  |                |

   A stopped call says "Stopped" in its description, as now.
5. **Status.** A running call is `status="running"` with a `Spinner` in its
   `TraceIcon`. A call that waits for an approval has a `status-waiting`
   icon. A failed call is `status="error"` with `text-foreground` on the line
   and `text-status-error` on the icon, because the `destructive` text of the
   component is 4.3:1 on `background`. `TraceDescription` gets
   `text-foreground-faint` (5.3:1), because its own colour is 4.1:1. The
   `cn` of the components merges classes, so a `className` wins.
6. **Output in a CodeBlock.** The stdout and stderr of a Bash call, and the
   text of an error, go in a `CodeBlock` of size `sm` in a
   `TraceCollapsibleContent`. An error block gets
   `bg-error-soft text-foreground border-transparent` (9.0:1). We do not use
   the `destructive` variant of CodeBlock (4.3:1). The stderr of a failed
   process (`FailedNotice`) goes in the same error block.
7. **Accessible names stay.** The page tests find a call by its region name
   (`Bash echo hello`, `Edit src/notes.txt`), the subagent toggle by "1 tool
   call", the spinner by "Running", and the approval by "Approval for …".
   The new parts keep these names, so a test changes only where the shape
   changes.
8. **Add the components with shadcn.** `pnpm dlx shadcn@latest add bubble
   code-block hover-card`. Trace, Progress, Spinner and Collapsible are
   already in `src/components/ui`.
9. **The file path stays draggable** from the target of a line, as from the
   card now (`docs/web-app/files.md`).

## Dropped

Each of these has no data or no server action. Record them in the docs of
the design boards, not in the app.

- **"Thought 4s".** The reducer drops `thinking` blocks, and their text is
  empty in each fixture (`background.jsonl`): Claude Code sends only the
  signature. So the app has no reasoning to show.
- **Suggestions** under a done turn. Nothing makes them.
- **Edit** on your message, and **Retry**, **Good response** and **Bad
  response** on an agent message. The server has no action for them.

## Resolved

1. **The diff in a CodeBlock:** yes, in phase 3. The reducer keeps at most
   200 lines in an optional `lines` field.
2. **Syntax colour:** no. No Shiki. The CodeBlock shows plain mono text.
3. **The context figure:** yes, in phase 4. In the composer of a DM, and in
   the card of each agent in the session panel.
4. **The model in the composer:** in a DM, a read-only label that links to
   Configure.
5. **Copy on an agent message:** yes. A ghost Copy button under each agent
   message that is done.
6. **Stop in the composer:** no. Stop stays in the header.

## Data flows

Phases 1 and 2 change the browser only. They read the same timeline items.

```
TimelineEntry[] ──▶ Timeline
                     ├─ groupByAuthor()          (as now)
                     ├─ runsOfCalls(block)       new: tool_call runs
                     ├─ user block  ──▶ Bubble (muted, end)
                     └─ agent block ──▶ header row
                                        ├─ message ──▶ text, mentions, code
                                        ├─ run ──▶ Trace
                                        │          └─ ToolCallLine
                                        │             ├─ TraceCollapsible (output, error, subagent)
                                        │             │   └─ CodeBlock | nested Trace
                                        │             └─ ApprovalItem (pending)
                                        └─ question, turn, notice (as now)
```

Phase 3 (diff lines) changes the reducer:

```
assistant/user line ─▶ reduceTimeline()
                        └─ toolResult(): Edit, Write
                             { kind: "diff", added, removed,
                               lines?: { kind: "add" | "remove" | "same", text }[] }   new, ≤ 200
store ─▶ event stream ─▶ ToolCallLine ─▶ CodeBlockLine variant added | removed
```

Phase 4 (context) changes the agent session:

```
stream_event message_start / assistant ─▶ usage
   input_tokens + cache_read_input_tokens + cache_creation_input_tokens  = used
result ─▶ modelUsage[model].contextWindow                                = window
agent session ─▶ AgentWithState.context = { used, window } | null      new
             ─▶ agent_state event (as now, with the new field)
browser ─▶ composer: "31% context" + HoverCard(Progress, "62,400 / 200,000")
```

`used` is the input of the last request, so it shows how full the context
is now. It is stored with the state of the agent, not in the timeline, so a
new session sets it to `null`.

## Workflows and states

- **A call that runs:** the line shimmers, with a spinner. No toggle while
  there is no output.
- **A call that waits:** the line shows the waiting icon, and the approval
  Item shows under it. After the answer, the Item goes, and the description
  says "Allowed" or "Denied". An expired request says "Expired".
- **A subagent:** the group is closed. It opens by itself while one of its
  calls waits, as now. Its trigger keeps the name "N tool calls".
- **A failed call:** the line is an error line, and its CodeBlock is open.
- **A long output:** the CodeBlock has `max-h-64` and scrolls. The text
  wraps (`wrap`).
- **A message that arrives:** as now, with the caret and `aria-busy`.
- **The composer:** Send is round and `primary`. Attach is round and
  outline. In a DM after phase 4, "N% context" opens a HoverCard on hover
  and on focus.

## The build

Each phase is one commit or more, green on its own: `pnpm test`,
`pnpm lint` and `pnpm build`. Follow the `tdd` skill for each behaviour.

### Phase 1: the components

- `pnpm dlx shadcn@latest add bubble code-block hover-card`.
- Check that the new files use `render`, not `asChild`, and the lucide icons
  (`components.json`).
- If question 2 says no Shiki, remove the hook and the Shiki package that
  the add brings, and keep `code-block.tsx`.

### Phase 2: the timeline and the composer

Files:

- `src/components/conversation/timeline.tsx`: the user Bubble, the agent
  header row, `runsOfCalls()`, the error CodeBlock of `FailedNotice`.
- `src/components/conversation/tool-call-card.tsx` becomes
  `tool-call-line.tsx`: `ToolCallLine`, the verb table, the icons, the
  status, the subagent group. `mainInput()` moves with it.
- `src/components/conversation/approval.tsx`: an outline `Item` in the
  place of the strip. `describeGrants()` stays.
- `src/components/conversation/composer.tsx`: round buttons.
- `src/components/conversation/working-line.tsx`: imports `mainInput()` from
  the new file.

Seams and the tests that change (`src/pages/conversations/[id].test.tsx`):

- "Your message shows at the right": the text is in a Bubble, and the
  header row says "You" only once for the block.
- "A Bash call shows its output when opened", and "an error shows open".
- "A subagent group opens when a call in it waits": keeps "1 tool call".
- "The approval answers": keeps "Allow once", "Always allow", and the
  region "Approval for …".
- "A file path drags from the line" (`docs/web-app/files.md`).

### Phase 3: diff lines (if question 1 says yes)

- `server/timeline/reduce.ts`: keep the lines of `structuredPatch`, with the
  cap. Test it with the Edit and Write fixtures in
  `server/timeline/reduce.test.ts`.
- `src/lib/agent-api.ts`: the optional `lines`.
- `ToolCallLine`: a CodeBlock with `CodeBlockLine` variants under an Edit or
  a Write. "N more lines" when the cap cuts it.

### Phase 4: the context figure (if question 3 says yes)

- The agent session reads `usage` and `contextWindow`, and puts `context`
  on `AgentWithState`. Test it with `resume-1.jsonl`, which has both.
- `src/components/conversation/composer.tsx`: the figure, the HoverCard and
  the Progress, in a DM.
- `src/components/conversation/session-panel.tsx`: the same figure in the
  card of each agent.

### Docs

In the same change as the code:

- `docs/web-app/conversation.md`: the Bubble, the header row, the Trace
  lines, the verb table, the approval Item, the colour rules.
- `docs/timeline.md`: the `lines` of a diff (phase 3).
- `docs/server.md` and `docs/agents.md`: `context` on the agent state
  (phase 4).
- `docs/plans/design-boards.md`: the dropped items of this plan.

Then delete this plan, or leave in it only what is still ahead.

## How we check it

- `pnpm test`, `pnpm lint` and `pnpm build` in the worktree, for each phase.
- `pnpm dev`, then open a DM and a channel. Run a Bash call, an Edit, a
  denied call and a subagent. Compare each with the boards.
- `pnpm test:live` once at the end of phase 4, because it reads a real
  `usage` (about 0.035 USD).
