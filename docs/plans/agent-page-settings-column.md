# The agent page as one settings column

**Status:** in progress. The user chose Option A and said to build it
(2026-11-17). The decisions below are settled. Nothing is open.

The design: the boards "A: new agent" and "A: edit test-runner" on the
"Agent form options" page of the Agent Chat canvas
(https://claude.ai/artifact/NyiP26udWrUFSDDX6BjutT). The user also said that
each form on a page (not in a dialog) uses this design. Today the agent page
is the only one.

## What changes

```
┌ sidebar ┬──────────────────────────────────────────────────────────────┐
│         │ Agents / test-runner                                         │
│         │ (avatar) test-runner  Working       Restart session  Stop    │
│         │ ───────────────────────────────────────────── On this page   │
│         │ Identity           Name  [@ test-runner   ]   > Identity     │
│         │ How people see…    Colour ● ● ● ◉ ● ●           Model and …  │
│         │                    Description [        ]       Folder and … │
│         │ ─────────────────────────────────────────       Tools        │
│         │ Model and          Model [claude-sonnet-5-5 v]   Instructions│
│         │ permissions  (•)   Permission mode                Command    │
│         │                    ┌ manual       note     ○ ┐               │
│         │                    ├ acceptEdits  note     ◉ ┤               │
│         │                    └ …                       ┘               │
│         │ ─────────────────────────────────────────                    │
│         │ Folder and limits  …                                         │
│         │ Tools              …  Add a usual tool: +Read +Edit …        │
│         │ Instructions       System prompt                             │
│         │ > Command (closed)                                           │
│         │ Delete agent                                                 │
│         ├──────────────────────────────────────────────────────────────┤
│         │ 2 unsaved changes. …            Discard   [✓ Save agent]     │
└─────────┴──────────────────────────────────────────────────────────────┘
```

## Decisions

1. **Sections, not cards.** Five sections: Identity, Model and permissions,
   Folder and limits, Tools, Instructions. Each has its title and one line at
   the left and its fields at the right. They stack at a narrow width. The
   column is at most 760 px wide.
2. **"On this page".** A list of links at the right goes to each section and
   to Command. It shows from the `lg` width. A section with an unsaved change
   shows a dot in the list and a "Changed" badge at its title.
3. **Permission mode is a radio group of cards.** Each card shows the mode and
   its note, so the user reads each effect before the pick. The notes are the
   `MODE_NOTES` of today. The radio takes its name from the mode, and its
   description from the note. `bypassPermissions` gets a "No prompts" badge.
   Rejected: keep the Select, because only one note shows at a time.
4. **Colour is a row of swatches.** Each swatch is a `RadioGroupItem` in the
   agent colour, with the colour as its accessible name. The legend shows the
   colour that is picked.
5. **Name has an `@` before it.** The description stays "People type @name to
   call it."
6. **Description and System prompt say "(optional)".** The Description says
   that the agent does not see it.
7. **No suffixes in the number inputs.** The labels "Maximum turns" and
   "Sleep after (minutes)" stay, so the unit stays in the accessible name.
   Rejected: the "turns" and "minutes" addons of the board, because a screen
   reader does not read an addon as part of the name.
8. **Usual tools.** Under Allowed tools: "Add a usual tool:" and one button
   for each of Read, Edit, Write and `Bash(git status)` that is not in the
   list. Its name is "Allow Read". The user did not answer this question, so
   this is the default of the board. It is a small change to remove.
9. **The command is a closed `<details>`.** Its summary is "Command". It
   keeps the region, the line "The app starts this in …" and Copy.
10. **A sticky bar at the bottom of the form.** It holds the status text and
    the actions. Save agent and Create agent move from the header to the bar.
    Stop agent and Restart session stay in the header.
    - New agent: "The agent starts when it gets its first message.", Cancel,
      Create agent.
    - Saved agent: "1 unsaved change" or "2 unsaved changes", and "The
      process that runs now keeps the old values.", Discard and Save agent.
      With no change: "All changes are saved." Save agent stays enabled,
      because a save of an agent in the `default` mode sends `manual`.
    - After a submit with an error: "Fix 2 fields: Name, Maximum turns."
11. **The delete section stays last.**
12. **Pending buttons.** While its request runs, a button shows a Spinner,
    says what it does ("Creating…", "Saving…", "Stopping…",
    "Restarting…"), and is disabled, so a second click sends nothing.
    The user asked for this on 2026-11-17.
13. **Toasts for each result.** The shadcn toast for Base UI
    (`pnpm dlx shadcn@latest add toast`), with one `<Toaster>` around the
    app. The user asked for this on 2026-11-17.
    - A success toast closes after 5 seconds: "test-runner is created.",
      "test-runner is saved.", "test-runner is stopped.", "test-runner
      starts again.", "test-runner is deleted."
    - An error toast stays until the user closes it, because the user must
      read the reason. Its title is the title of the alert of today ("The
      server refused the agent.", "Stop agent did not work.") and its
      description is the reason of the server.
    - The toast replaces the `RefusalAlert` on the agent page. A message for
      a field still shows under its field.
    - Rejected: a toast and an alert together, because they say the same
      thing twice.
14. **The rest of the app is a second change.** The dialogs (Create a
    channel, Channel settings, Group chat settings, Start a chat, Members)
    and the × of the sidebar get pending buttons and toasts in their own
    worktree, after this change merges. That change uses the `<Toaster>` of
    this one.

## Data flow

- The page keeps the loaded agent as `saved` (as today). The unsaved count
  compares each value of `form.state.values` with `saved`. Arrays compare by
  their items.
- Discard calls `form.reset()`. The default values are `saved`, so the form
  goes back to the saved agent.
- The bar reads the fields with an error from `form.state.fieldMeta`, with
  `invalid()` of `src/lib/form-errors.ts`.
- Nothing changes on the server or in `server/schemas.ts`.

## The build

Seam: the agent page at `/agents/new` and `/agents/:id`, rendered with
`<App />` and the fake network, as in `src/pages/agents/[id].test.tsx`. One
test for each slice, red before green:

1. The permission mode is a radio group, and each card shows its note.
   The tests that use `pick("Permission mode", …)` click the radio instead.
2. The swatches and the legend that names the picked colour.
3. The sections and "On this page", with a link to each section.
4. The command opens from its summary. The command test opens it first.
5. A usual tool goes into the allowed tools with one click, and its button
   goes away.
6. A saved agent counts its unsaved changes, marks the changed section, and
   Discard brings back the saved values.
7. After a submit with errors, the bar names the fields to fix.
8. A save shows "Saving…" while it runs, then a success toast. A refused
   save shows an error toast, in place of the alert.
9. Create agent, Stop agent, Restart session and Delete agent: the same
   pending state and toasts. The fake network holds a response until the
   test lets it go, so the test can see the pending state.

Then the style of the layout (no seam): the column, the sticky bar, the
narrow width. Check it in the browser with `pnpm dev`.

## When it lands

- `docs/web-app/agent-page.md` describes the new page.
- `docs/forms.md` gets the rule: a form on a page uses this layout, and a
  form in a dialog keeps the dialog layout.
- `docs/web-app.md` names the Option A boards as the design of the agent
  page.
- The memory `page-forms-use-option-a` is deleted, because `docs/forms.md`
  holds the rule.
- This plan is deleted.
