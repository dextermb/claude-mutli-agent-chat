# Make the app follow the design boards

**Status:** in progress. The user approved the plan and the seams on 2026-11-15.

Sources:

- Boards: the "Agent Chat" canvas, 21 boards
  (https://claude.ai/artifact/NyiP26udWrUFSDDX6BjutT).
- Design system: "Gruvbox Chat"
  (https://claude.ai/artifact/3cUXEWP7TNyCWaxnSe8fYu).

## What is already true

- The colour tokens in `src/index.css` are the same as `tokens.json`.
- The fonts (Geist, Geist Mono), the radii and the shadcn components are the
  same.
- Most of the timeline already matches: the message row, the tool-call card,
  the approval ButtonGroup, the question card, the turn summary and the
  failed notice.
- Create a channel matches the board, except for the width and one sentence.

So this change is a set of gaps, not a new theme.

## How the gaps sort

Each gap has one of three kinds:

| Kind      | Meaning                                         | In this change?        |
| --------- | ----------------------------------------------- | ---------------------- |
| STYLE     | Classes, sizes, colours, copy                   | Yes                    |
| STRUCTURE | Other components or markup, same data           | Yes                    |
| BEHAVIOUR | Needs new data, a new route or a new workflow   | Only the ones in Tier 2 |

## Decisions

- **Scope: Tier 1 and Tier 2.** Tier 3 waits for its own plans.
- **Channel members: build the Members aside (S11).** It replaces the
  session panel of each agent in a channel or a group chat. A DM keeps its
  session panel.
- **The rail: all the buttons of the board.** Direct messages and Activity
  have no page yet, so each one is a disabled button with the tooltip "Not
  built yet". A button that does nothing when it looks active is a trap for
  the user. The user avatar shows "You", because the app has no user name.
  Rejected: a rail with Home and Agents only.
- **Selects: the Base UI `Select`** for Model and Permission mode, as the
  board shows. `docs/web-app/agent-page.md` and the tests change with it.
  Rejected: keep `NativeSelect`.
- **Stop in a DM header:** keep it, before the tabs, as DmQuestion shows.
- **New session confirm:** keep `AlertDialog`. A confirm of an action that
  stops a turn is what an alert dialog is for.
- **The count badge in the sidebar** counts the unread agent messages of a
  conversation (not the tool calls). The board calls it a mention count, but
  the user has no name, so no message can mention the user. A DM counts the
  same way.

## Tier 1: the data exists

### S1. Shared parts

- `agent-look.ts`: add a text class for each status (`text-status-*`) next
  to `dot`, for the status Badge.
- Dialog width: `max-w-[480px]` loses to `sm:max-w-sm` in
  `ui/dialog.tsx`. Use `sm:max-w-[480px]`, `sm:max-w-[520px]` and
  `sm:max-w-[440px]`.
- `RefusalAlert`: use `ui/alert.tsx` (destructive) with a warning icon, an
  optional bold title (the action: "Stop turn did not work."), the reason, and
  "Close the alert". Use it in the session panel, Add members and the agent
  form.

### S2. Sidebar (`app-sidebar.tsx`)

- Rebuild it on the shadcn `Sidebar` parts (`SidebarProvider`,
  `SidebarGroup`, `SidebarGroupAction`, `SidebarMenuButton`, …). The file
  `ui/sidebar.tsx` exists but nothing uses it.
- The open conversation gets the `sidebar-primary` fill (orange), through
  `isActive`.
- Add the 64 px workspace rail: the "AL" tile, Home, Direct messages
  (disabled), Activity (disabled), Agents, and the user avatar. Home links to
  `/`. Agents links to `/` too, because the home page is the agents page.
  Below 768 px the rail goes into the sidebar sheet.
- Add the chevron after "Agent Lab".
- Add the `+` of Group chats, "Start a group chat". It opens Start a chat.
- Footer text in `foreground-faint`.

### S3. Agents home (`pages/index.tsx`)

- Read the agents from `useWorkspace()`, which already holds `state`, live.
- Add the subtitle, the search (filters by name), and the summary line
  "5 agents · 1 working · 1 needs approval · 1 error".
- Use `ItemGroup` and `Item variant="outline"`, an `AvatarBadge` status dot,
  and an outline status Badge.
- Add the empty state of the board: the dashed box, the bot icon, "There are
  no agents.", the text and New agent.
- Column `max-w-[880px]`, `gap-5`, a left border.

### S4. Agent page (`pages/agents/[id].tsx`, `tool-rules.tsx`)

- Show `AppSidebar` on both screens of this page. Today neither screen has
  it.
  - New agent (`/agents/new`): no row is active. Breadcrumb "Agents / New
    agent".
  - Saved agent (`/agents/:id`): the row of that agent is active. Breadcrumb
    "Agents / name".
  - Below 768 px: an "Open the sidebar" button in the header, as on the
    other pages.
- Saved agent: a large avatar with a status dot, and the status Badge (from
  `useWorkspace()`). The subtitle "Runs in 2 channels and 1 group chat."
  comes from the members of the conversations.
- New agent: the bot circle, "The agent starts when it gets its first
  message.", Cancel, and "Create agent". Default colour green.
- Working directory: `InputGroup` with a folder icon.
- Permission mode: a description for each mode.
- Autostart: label and description first, the Switch at the end.
- Tools: `InputGroup` with an Add button, the empty text "No allowed tools.
  Each tool waits for your approval.", and the placeholder "Block a tool, for
  example WebFetch".
- Instructions: the placeholder, the descriptions of the board.
- Field errors: `aria-describedby` to the error, and no description under a
  field with an error.
- Model and Permission mode: the Base UI `Select`, with a mono trigger.

### S5. Conversation header (`pages/conversations/[id].tsx`)

- DM: an `AvatarBadge` status dot, a coloured status Badge, and Configure
  (outline, links to `/agents/:id`).
- Channel and group: a secondary `sm` button with an `AvatarGroup` and the
  member count. It opens the Members aside (S11), with `aria-expanded`.
- "Stop all" in place of "Stop", before the members button.
- Icon and title in one group, 6 px apart. "Invite agents" at default size.
- Phone: `icon` size for the menu button, a cpu icon for Session.

### S6. Timeline (`timeline.tsx`, `tool-call-card.tsx`, `approval.tsx`)

- The DM intro: a large avatar, "This is your DM with **name**. In a DM, the
  agent replies to every message. It runs Claude Code in `cwd`."
- The New session divider: link colour, dashed lines, restart icon.
- The status lines above the composer:
  - "X needs your approval." for a permission, "X waits for your answer."
    for a question, each followed by "Your next message waits until this
    turn ends."
  - A line for an agent in Error or Stopped: "migrator stopped. Your next
    message starts it again and resumes the session."
- Subagent card: the description in sans, "N tool calls" as a ghost `xs`
  button in the header row, compact child rows, and the waiting dot when a
  child waits.
- Approval caption: the prefix "Always allow:".
- Human row: `items-baseline`, 2 px gap.

### S7. DM tabs (`files-tab.tsx`, `session-log-tab.tsx`)

- Files: the heading "N files", the intro and the footnote, the table in a
  bordered box, `th scope="col"`, "Last action" as a Badge, "Lines" with
  coloured `+N` `−N`, a file icon.
- Session log: the intro with `in` and `out` coloured, the bordered box, three
  columns on each row, "Load earlier lines" centred with a clock icon, and the
  "Process started" row on the rail ground.

### S8. Session panel and New session

- A visible "Session" heading, `gap-4`, `gap-y-2` in the list.
- Values in the default foreground, Turns and Cost in sans with
  `tabular-nums`.
- The "configuration changed" callout on `mention-soft` with an info icon,
  above the list.
- Allowed tools as `secondary` Badges.
- Remove: ghost, trash icon, "Remove".
- New session: keep `AlertDialog` (Q4), add the three-item list, the restart
  icon and the width of 440 px.
- Phone sheet: `SheetHeader`, the flat list, a `Separator`, and "Allowed
  tools" with the hint. Width 320 px, max 85vw.

### S9. Dialogs

- Start a chat: a `Separator` above the list, an "Agents" heading, a status
  dot on each avatar.
- Add members: the heading "Agents that are not members", `Item
  variant="outline"`, sm avatars, mono descriptions, "Add X" as the checkbox
  label, the "N picked" count, the alert above the list, and a description
  that depends on `replyMode`.

### S10. Composer (`composer.tsx`)

- The `@` list: a "Members" label, and each row an `Item` with an avatar,
  the name and a status Badge. This needs the agents, not only their names.
- `Kbd` for "Tab" and "Enter".

### S11. The Members aside (channel and group chat)

The button in the header (S5) opens it at the right, 360 px wide. Below
768 px it is a `Sheet` from the right.

```
┌ Members ─────────────────── [x] ┐
│ 1 person · 3 agents              │
│ Agents reply when you @mention.  │
│ (Y) You                          │
│ (TR)• test-runner  sonnet [Working] v │  ← one row open at a time
│   ┌ the session card of S8 ─────┐│
│   │ list, Stop turn, New session,││
│   │ Remove, the alert            ││
│   └─────────────────────────────┘│
│ (RB)• reviewer-bot opus  [Idle] > │
│ [Invite agents]                  │
└──────────────────────────────────┘
```

- Each agent row is a button with `aria-expanded`. It holds an avatar with a
  status dot, the name, the model in mono, and an outline status Badge.
- One row opens at a time, so the page keeps `pickedId` and the one
  `useSessionCard()` call that it has now.
- The open row shows the session card of S8 without the Model row. Its
  refusal alert stays inside the row.
- "Invite agents" (channel) or "Add people or agents" (group chat) opens the
  dialog of S9.
- The working line moves into the end of the timeline as one sentence:
  "test-runner is working. reviewer-bot and release-bot are idle." Below it,
  a hint: "Agents reply to each other when one @mentions another. Stop all
  ends the chain."

## Tier 2: small server changes

### T1. Unread counts in the sidebar

- `Store.listUnread()` becomes `Store.unreadCounts(): Record<string, number>`.
  It counts the timeline items of kind `message` by an agent after
  `last_read_seq`.
- `GET /api/conversations` sends `unread` as that record.
- The `unread` event gets `count` in place of the boolean `unread`. The
  server sends it when the count changes.
- `useWorkspace()` keeps the record. The sidebar shows the count in a
  `SidebarMenuBadge` in the mention colour, and a screen reader hears "3
  unread".

### T2. Counts on Grep and Glob

- `toolCallResult()` gets a result kind `{ kind: "count", count, unit }`,
  with `unit` `"matches"` for Grep and `"files"` for Glob. The value comes from
  the `tool_use_result` of a recorded fixture. If no fixture holds Grep or
  Glob, record one with `pnpm fixtures:record` (about 0.01 USD) before the
  reducer test.
- The tool-call card shows "3 matches" or "6 files" in `muted-foreground`.

### T3. A stopped tool call

- The reducer gives the status `stopped` (not `error`) to the tool call that
  ran when a turn ends with `aborted_tools` (F28). It drops the result text.
- The card shows a grey (`status-idle`) dot and "Stopped".
- `docs/timeline.md` changes in the same commit.

### T4. Inline code in a message

- The timeline renders the text between two backticks as `code`: mono, on
  `muted`, in `agent-yellow`, radius 6 px. No other markdown. A small pure
  function splits the text, so no library is needed.

## Tier 3: not in this change

These need a feature, not a design pass. Each one gets its own plan.

- File sharing (the three File boards): upload, link by hash, `--add-dir`,
  chips, shared files in the thread.
- People: other humans, their names, presence, "Dexter" in place of "You",
  and people in Start a chat and Add members.
- The rail buttons Direct messages and Activity: no route and no feed.
- Channel settings (the `more` button): no `PATCH` route.
- Attach and slash buttons in the composer.
- Agent page: Description, Maximum turns, the Command preview, Browse, and
  Stop agent and Restart session at agent level.

## Resolved questions

- Q1 Channel members: build the Members aside (S11).
- Q2 The rail: all the buttons, the two with no page disabled.
- Q3 Selects: the Base UI `Select`.
- Q4 Stop in a DM header: keep it, before the tabs.
- Q5 Scope: Tier 1 and Tier 2.

## How it is built and checked

- One worktree, `design-boards`. One commit for each slice: T1 to T4 first,
  because S2 and S6 show their data, then S1 to S11.
- Test-first where a behaviour changes, with the `tdd` skill. Each seam
  below already has a test file (`docs/testing.md`), except `pages/index.tsx`,
  which has `src/pages/index.test.tsx`.

| Seam                                | What the tests show                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| `Store`                             | T1: the count of unread agent messages, and 0 after a read            |
| `createServer()`                    | T1: the counts in `GET /api/conversations` and the `unread` event      |
| `useWorkspace()`                    | T1: the counts change with the events                                |
| `reduceTimeline()`, a fixture       | T2: the Grep and Glob counts. T3: the `stopped` call                  |
| The DM page, fake network           | T2, T3, T4 on the cards. S5: Configure. S6: the intro, the status lines |
| The channel page, fake network      | S11: the aside, one row open, Stop all, the line "X is working."      |
| `<App />` at `/`                    | S2: the rail, the count badge. S3: search, summary, empty state         |
| The agent page, fake network        | S4: the sidebar on both screens, the breadcrumb, "Create agent", the status, the Base UI selects |
| The Start a chat, Add members dialogs | S9: "Add X", "N picked", the alert above the list                   |
| `Composer`                          | S10: the status of each agent in the `@` list                         |

- A change to style only gets no new test. Each slice runs `pnpm test`,
  `pnpm lint` and `pnpm typecheck`.
- At the end: `pnpm build`, then screenshots of each page at 1440 px and at
  390 px, compared with the boards.
- Docs: update `docs/web-app/sidebar.md`, `conversation.md`,
  `session-panel.md` and `agent-page.md`, and `docs/server.md`,
  `docs/store.md` and `docs/timeline.md` for T1 to T3, in the same slices.
- When the change is merged, this plan holds only Tier 3, or it is deleted.
