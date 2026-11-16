# File sharing

**Status:** awaiting go-ahead. Nothing is built. The decisions below are
proposals. Nine questions are open. On 2026-11-16 the user chose `@` as the
trigger of file completion (decisions 15 to 19), and asked for a list of the
shared files that agents can read with a tool and the user can change
(decisions 20 to 27). Decision 28 makes the use of shadcn/ui explicit.

This is the Tier 3 item "File sharing" of `docs/plans/design-boards.md`. It
also builds the Attach a file button of the item "The composer buttons".

Boards: FileDrop, FileChips and FileInThread in the "Agent Chat" canvas.

## What the boards show

- **FileDrop.** A drag over the conversation shows a dashed drop zone over
  the thread, with "Press Esc to cancel." It has two forms:
  - From the disk: "Drop to share with #release-train". Two notes explain
    the result. **Linked:** a file that is in the folder of an agent stays
    where it is, and the agent changes the real file. **Copied:** any other
    file goes to the uploads of the conversation, and each agent in it can
    read it.
  - From the app (for example the path of a tool call card): "Drop to add
    src/router/routes.ts". Nothing is copied, and the path goes into the
    message.
- **FileChips.** Over the text of the composer, a grid of chips, "Files for
  this message". Each chip has an icon, the name, a badge and a detail line:
  - `Linked` (green) with the path, for example `~/code/web-app/src/auth.test.ts`.
  - `Copy: 60%` (yellow) with "1.2 of 2.0 MB" and a progress bar.
  - `Copied` (grey) with the path in the uploads.
  - `Refused` (red) for a folder: "A folder cannot be shared. Drop the files
    in it."
  - Each chip has "Remove <name>". The hint at the end of the composer says
    "Send waits until ci-log.txt is copied. Remove the folder to send.", and
    Send is disabled.
- **FileInThread.** The message of the user shows its text, then "Shared
  files": one row for each file, with the name, the badge, the path, a note
  ("Edited by test-runner at 14:05", "Read by test-runner at 14:05", "No
  agent read it yet.") and "Copy the path of <name>". A file that is gone
  shows `Missing` and "The file is not there any more. Drop it again to
  share it." The tool call cards of the agent show the same paths.

## What exists now, and what limits the design

- **A browser does not give the path of a dropped file.** It gives the name,
  the size, the type and the content. So "Linked" cannot use the path. The
  browser must send a fingerprint (name, size and SHA-256 of the content),
  and the server must find a file with the same fingerprint in the folders of
  the agents.
- **`claude` 2.1.311 has `--add-dir <directories...>`** ("Additional
  directories to allow tool access to"). It is not measured yet in `-p` mode
  with `stream-json` input.
- **An argument reaches only a new process.** A process that started before
  the first upload does not have the uploads folder.
- **A message is text only.** `MessageItem` is `{ kind, id, text, status }`.
  `POST /api/conversations/:id/messages` takes `{ text }`. The prompt holds
  the text only (`docs/conversations.md`).
- **The store keeps each item as JSON in `timeline_items.payload`.** A new
  field on a message needs no migration.
- **`filesOf()` in `src/lib/files.ts`** already turns the tool calls of a
  timeline into the files that an agent read or changed. The notes of
  FileInThread can come from the same entries.
- The database is at `AGENTS_DATABASE`, `.data/agents.db` by default.

## Decisions

1. **Two kinds of shared file.** `linked`: a file in the folder (`cwd`) of an
   agent that is a member of the conversation. `copied`: a file in the
   uploads folder of the conversation.
2. **Linked by fingerprint.** For each dropped file, the browser computes
   SHA-256 with `crypto.subtle.digest`, then asks
   `POST /api/conversations/:id/files/find` with `{ name, size, sha256 }`. The
   server walks the folder of each agent member, takes the files with the
   same name and size, and hashes only those. One match gives `linked` with
   its path. More than one match takes the most recently changed file. No
   match: the browser uploads the file (decision 4).
3. **A bounded walk.** The walk skips names that start with `.`, and
   `node_modules`, `dist`, `build` and `target`. It stops after 50,000
   entries or 2 s for each agent folder. A walk that stops gives no match, so
   the file is copied. Nothing is wrong, only less direct.
4. **Copied by upload.**
   `PUT /api/conversations/:id/uploads?name=<name>` takes the raw bytes. The
   server keeps only the base name, and writes to
   `<uploads>/<conversation id>/<name>`. A name that exists gets ` (2)`,
   ` (3)` before its extension. The answer is `{ name, path, size }`. The
   browser sends with `XMLHttpRequest`, because `fetch` gives no upload
   progress, and the chip shows the percentage.
5. **The uploads folder** is `AGENTS_UPLOADS`, by default `uploads/` next to
   the database (`.data/uploads`), made absolute at the server start. One
   subfolder for each conversation, named by its ID, because a group chat
   can change its name.
6. **Each process gets `--add-dir <uploads>/<conversation id>`.** The server
   makes the folder before it starts the process. So a file that is copied
   later is readable with no restart. `claudeArgs()` gets one more session
   value, and the Command preview shows `--add-dir '<uploads>'`.
7. **From the app: a path, not a file.** A tool call card with a file path
   can be dragged. It carries `application/x-agent-path` with the absolute
   path. A drop adds a `linked` chip with no fingerprint and no request.
8. **A folder is refused in the browser.** A drop entry that is a folder
   (`webkitGetAsEntry().isDirectory`) gives a `Refused` chip, as the board
   shows. Send stays disabled until the user removes it.
9. **The message.** `POST /api/conversations/:id/messages` takes
   `{ text, files: [{ name, path, kind, size }] }`. The server checks each
   path again: a `linked` path must exist and be inside the folder of an
   agent member, and a `copied` path must be inside the uploads of the
   conversation. A refused path gives `400` "<name> is not a file that this
   conversation can share.". `MessageItem` gets an optional `files`. A
   message may have files and no text.
10. **The prompt.** After the text of the message, one line for each file:
    `[Shared file: /abs/path]`. In a group chat or a channel, the line comes
    after the message line of its author. `read_messages` of the chat MCP
    server gives the `files` too (`docs/mcp.md`).
11. **The thread** shows "Shared files" under the text, as FileInThread. The
    badge is `Linked` or `Copied`. The note comes from the timeline: the last
    `Edit` or `Write` of that path ("Edited by <agent> at 14:05"), else the
    last `Read` ("Read by …"), else "No agent read it yet.". "Copy the path
    of <name>" puts the absolute path on the clipboard.
12. **The name is not a link** in the first build. The board shows a link,
    but the app has no route that serves a file, and a route that serves any
    shared path needs its own care. See question 5.
13. **The drop zone** shows when a drag with `Files` or
    `application/x-agent-path` enters the conversation page. Esc, or a drag
    that leaves the page, hides it. A drop anywhere on the page adds the
    chips to the composer. In a DM, the text says "Drop to share with
    <agent>".
14. **Attach a file** (the paperclip in the composer) opens the file input of
    the browser with `multiple`. Each picked file goes through the same steps
    as a dropped file.

### File completion with `@`

15. **`@` completes agents and files.** The list after `@` has two groups:
    **Members**, as today, then **Files**. The user picks one row, so a file
    and an agent never mix. This follows Claude Code, where `@src/auth.ts`
    means a file, so the users and the agents already read it that way.
    `#` was the second choice (as in VS Code chat: `@` agents, `#` files,
    `/` commands). It was rejected because the app shows a channel as
    `#name`, and a later link to a channel would clash with it. `/` stays for
    slash commands.
16. **The folders.** In a DM, the folder of the agent. In a group chat or a
    channel, the folders of all the agent members. Each file row names its
    agent and folder, for example "test-runner · ~/code/web-app". Two agents
    with the same folder show it once.
17. **The search route.** `GET /api/conversations/:id/paths?q=<text>` gives
    the best 20 files and folders whose path contains the typed text, with
    `{ path, relative, agentId }` for each. In a git repository it reads
    `git ls-files --cached --others --exclude-standard`, which is fast and
    keeps out what `.gitignore` names. Else it uses the bounded walk of
    decision 3. The server keeps the list of each folder for 30 s, so the
    list stays fast while the user types. A shorter path ranks first, then
    a match at the start of a name.
18. **What the pick does.** The composer inserts `@<relative path> ` in the
    text, for example `@src/auth.test.ts`, and keeps the absolute path. On
    Send, each picked path goes into `files` as a `linked` shared file
    (decision 9). So each agent gets `[Shared file: /abs/path]` (decision
    10), also an agent with another folder, and the thread shows the file
    under "Shared files". A picked path that the user then deletes from the
    text is not sent.
19. **The mention parser must not take a path.** Today
    `server/conversation/mentions.ts` refuses only a letter, a digit or `-`
    after a name. So `@test-runner/notes.md` mentions test-runner. The new
    rule: a name must also not be followed by `/`, or by `.` and a letter. A
    file at the top of a folder whose path is the name of a member is
    inserted as `@./<name>`.

### The shared files list

20. **Each conversation has one list of shared files.** A file joins the
    list when a message shares it, in a DM, a group chat or a channel. The
    list is a set of paths: a second message with the same path does not add
    a second row. It updates `shared_at` and `shared_by`, and it puts back a
    removed file.
21. **A table holds the list, not the message JSON**, because the list
    changes after the message: the user can remove a file. The new table
    `shared_files` is in the ERD below (migration 8). The message keeps its
    own `files`, so the thread still shows what the message shared.
22. **The chat MCP server gets `list_files`.** Input: `conversationId?`
    (this conversation when it is left out, as the other tools). Output:
    `files`, each with `id`, `name`, `path` (absolute), `kind`, `size`,
    `sharedBy` (a name), `sharedAt`, and `exists` (the path is on the disk
    now). A removed file is not in the output. The tool only reads, so it
    goes into `READ_TOOLS` and needs no permission card. An agent that is not
    a member gets the same refusal as `read_messages`. The rule in
    `agent/environment.md` and the chat skill name the tool.
23. **The user removes a file from the list**, with
    `DELETE /api/conversations/:id/files/:fileId`. The row gets `removed_at`
    and `removed_by`. It is not deleted, so the thread can say what happened.
    A removed file can be shared again with a new message.
24. **What Remove does to the file on the disk.** A `linked` file is never
    touched: it is the real file of a project. A `copied` file is deleted
    from the uploads, because the user removes a file that should not be
    there. See question 8.
25. **The agents learn of a removal from the tool only.** No prompt goes to
    an agent, so a removal does not start a turn and costs nothing. An
    agent that calls `list_files` sees the list of now. See question 9.
26. **Where the user sees the list.**
    - **A group chat or a channel:** a "Files" button in the header, next
      to the members button, with the count. It opens the panel "Shared
      files" (an `aside` of 360 px, or a `Sheet` below 768 px), in the same
      way as the members panel. Only one of the two panels is open at a
      time.
    - **A DM:** the Files tab gets a section "Shared files" over the files
      that the agent read or changed. On a phone, the Files view of the
      Session sheet leads there.
    - **Each row:** the name, the badge (`Linked` or `Copied`), the path,
      "Shared by <name> at 14:04", the note of decision 11, "Copy the path
      of <name>", and "Remove <name>". Remove of a `copied` file asks first:
      "Remove ci-log.txt? The copy in the uploads is deleted. The message
      keeps its name." Remove of a `linked` file needs no question, because
      nothing is lost.
27. **The thread after a removal.** The row of the file under the message
    keeps the name and the path, with the badge `Removed` and the note
    "Removed from the shared files at 14:20.". A `copied` file then has no
    Copy the path button, because the path is gone. A new event,
    `{ type: "files", files }` on the stream of the conversation, carries
    the list after each change, so the panel, the counts and the thread
    follow.

### The UI components

28. **Build each part of the UI with the shadcn/ui components of the
    project.** The user asked for this explicitly on 2026-11-16.
    - Use the components in `src/components/ui`. Do not write a new UI
      primitive by hand, and do not copy the markup of a component.
    - A component that the project does not have yet comes from the CLI,
      `pnpm dlx shadcn@latest add <name>` (the rule in `CLAUDE.md`). This
      plan needs two: `progress` (the copy bar of a chip) and `empty` (an
      empty list of shared files).
    - The components run on Base UI, so a trigger or a link that looks like
      a button uses the `render` prop, not `asChild`.
    - The style comes from the tokens of the design system, as the rest of
      the app. A class adds layout only, not new colours.

    | Part                       | Components                                                                                                                   |
    | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
    | Drop zone                  | `Empty` (icon, title, description) inside the dashed overlay, `Item` for the two notes, `Kbd` for Esc                        |
    | Chips in the composer      | `InputGroup` with `InputGroupAddon align="block-start"`, `Item` for each chip, `Badge`, `Progress`, `Button` (Remove, Retry) |
    | Attach a file              | `InputGroupButton` with a hidden file `input`                                                                                |
    | Send hint, refused chip    | `Badge variant="destructive"`, the text of `InputGroupAddon`                                                                 |
    | `@` list, Files group      | The `listbox` of the composer as it is today, with a group label and `Item` rows                                             |
    | Shared files in the thread | `ItemGroup` and `Item`, `Badge`, `Button` with `Tooltip` for Copy the path                                                   |
    | Files button and panel     | `Button` with a `Badge` with the count, `Sheet` below 768 px, `ScrollArea`, `ItemGroup`, `Item`, `Empty`                     |
    | Remove of a copy           | `AlertDialog`, as Stop agent and New session                                                                                 |
    | DM Files tab section       | `Item`, `Badge`, `Separator` between the two sections                                                                        |

## Open questions

1. **The size limit of one upload.** My recommendation: 25 MB. A larger
   file gets a `Refused` chip: "The limit is 25 MB.".
2. **The cost of the walk.** Decision 3 bounds it. Is a fingerprint search
   in the agent folders acceptable to you at all? The other choice: each
   dropped file is copied, and only a drag from the app is linked. That is
   simpler and faster, but the agent then changes a copy, not the real file.
   My recommendation: keep the search.
3. **More than one match.** Decision 2 takes the most recently changed
   file. The other choice: copy the file, because the app cannot know which
   one the user means. My recommendation: take the most recent one, and show
   its path in the chip, so the user can see it before Send.
4. **Missing.** The board shows a file that is gone. This needs a check on
   the disk each time the thread loads. My recommendation: a second slice,
   after the first build works. The server adds `exists: false` to a shared
   file in `GET …/timeline` when the path is gone.
5. **Open a shared file from the thread.** My recommendation: leave it out
   now (decision 12), and add it later with a route that serves only the
   paths of shared files of that conversation.
6. **Does `claude -p` expand `@path` in a prompt?** The interactive CLI
   attaches the file of an `@path`. If `-p` with `stream-json` input does
   the same, the agent gets the content at once. If it does not, the
   `[Shared file: …]` line still gives the path. The live check of slice 0
   answers it. The design does not depend on the answer.
7. **Old uploads.** Nothing deletes them. My recommendation: leave them.
   They are small, and an agent may still need one. A later change can add a
   clean-up. Decision 24 deletes a copy only when the user removes it.
8. **Remove deletes a copy.** Decision 24 deletes a `copied` file from the
   uploads. The other choice: keep it on the disk, and only take it off the
   list. That lets the user undo, but an agent can still read a file that
   the user wanted gone. My recommendation: delete it, and ask first.
9. **Tell the agents of a removal?** Decision 25 sends no prompt. The other
   choice: a line in the next prompt of each agent, "[Removed file:
   /abs/path]". That costs nothing extra, because it waits for the next
   message, and it tells an agent to stop using the file. My
   recommendation: add that line. It is small, and it stops an agent from
   working on a file that the user removed.

## Data flow

```
Drop or Attach (browser)
  ├─ a folder ─────────────▶ chip Refused
  ├─ from the app (path) ──▶ chip Linked (no request)
  └─ a file
       ├─ SHA-256 in the browser
       ├─ POST /api/conversations/:id/files/find { name, size, sha256 }
       │    └─ walk the cwd of each agent member: name + size, then hash
       ├─ match ─▶ chip Linked { path }
       └─ none  ─▶ PUT /api/conversations/:id/uploads?name=  (XHR, progress)
                     └─ <uploads>/<conversation id>/<name>
                  ─▶ chip Copied { path }

Send
  └─ POST /api/conversations/:id/messages { text, files }
       ├─ check each path (linked: in an agent cwd, copied: in the uploads)
       ├─ store: message item { text, files }   (timeline_items.payload)
       ├─ stream: { type: "item", entry }
       └─ prompt: text + "[Shared file: <path>]" lines

@ in the composer
  └─ GET /api/conversations/:id/paths?q=<text>
       └─ git ls-files, else the bounded walk, cached 30 s for each folder
  ◀─ Members group + Files group
  pick a file ─▶ text "@src/auth.ts " + linked path kept for Send

Process start
  └─ mkdir <uploads>/<conversation id>
  └─ claudeArgs(..., { addDir }) ─▶ --add-dir <uploads>/<conversation id>
```

The JSON in `timeline_items.payload` of a user message gains
`files: [{ name, path, kind, size }]`. The list of decision 20 is a new
table.

```
conversations                         timeline_items
  id  PK  ───────────────┐              id  PK
  …                      │1             …
                         │              ▲
                         │N             │1  (the message that shared it last)
                   shared_files  (new, migration 8)
                     id               PK  TEXT, UUID
                     conversation_id  FK  → conversations.id  ON DELETE CASCADE
                     item_id          FK  → timeline_items.id ON DELETE SET NULL
                     name                 TEXT
                     path                 TEXT, absolute
                     kind                 TEXT  'linked' | 'copied'
                     size                 INTEGER
                     shared_by            TEXT  member key, 'user:me' today
                     shared_at            TEXT
                     removed_at           TEXT  NULL while on the list
                     removed_by           TEXT  NULL while on the list
                     UNIQUE (conversation_id, path)
```

- One conversation has many shared files (1:N). Each row names the last
  message that shared it (N:1). A conversation that is deleted takes its
  rows with it.
- New queries in `server/store/store.ts`: `shareFiles(conversationId,
itemId, files, sharedBy)`, `listSharedFiles(conversationId)` (the rows
  with no `removed_at`), `getSharedFile(id)`, and
  `removeSharedFile(id, removedBy)`.

```
list_files (agent, MCP)
  └─ member check ─▶ listSharedFiles(conversationId) + stat of each path
  ◀─ { files: [{ id, name, path, kind, size, sharedBy, sharedAt, exists }] }

Remove (user)
  └─ DELETE /api/conversations/:id/files/:fileId
       ├─ removeSharedFile(id, "user:me")
       ├─ copied: delete the file from the uploads
       ├─ stream: { type: "files", files }
       └─ the next prompt of each agent: "[Removed file: <path>]"  (question 9)
```

## Workflow

```
composer
  │ drag enters ─▶ drop zone ── Esc / leave ─▶ composer
  │                    │ drop
  ▼                    ▼
chips: Refused | Linked | Copy: n% ─▶ Copied | Upload failed (Retry, Remove)
  │
  ├─ any Refused or Copy: n% ─▶ Send disabled, hint says why
  └─ all Linked or Copied   ─▶ Send ─▶ message with "Shared files"
```

- A failed upload shows a red chip "The copy did not work." with Retry and
  Remove.
- Remove on a copied chip removes it from the message only. The file stays in
  the uploads.

```
Files button (group chat, channel) or Files tab (DM)
  └─ Shared files: one row for each file on the list, newest first
       ├─ Copy the path
       └─ Remove
            ├─ linked ─▶ off the list at once
            └─ copied ─▶ "Remove ci-log.txt?" ─ Cancel / Remove ─▶ off the list, copy deleted
  An empty list: "No files are shared here yet. Drop a file on the conversation to share it."
```

## The build

Test-first, one slice at a time. The seams: `createServer()` for the routes,
`buildArgs()` for `--add-dir`, the conversation page for the composer and the
thread, and `filesOf()` for the notes.

| Slice                  | Content                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Live check          | One recording (about 0.02 USD): a `Read` of a file in an `--add-dir` folder, in `default` mode, with no permission request (if it asks, decision 6 changes), and a prompt with `@notes.txt` (question 6). |
| 1. Uploads             | `AGENTS_UPLOADS`, the upload route, safe names, the size limit.                                                                                                                                           |
| 2. `--add-dir`         | The folder at the process start, `claudeArgs()`, the preview.                                                                                                                                             |
| 3. Messages with files | The message route, the checks, `MessageItem.files`, the prompt lines, `read_messages`.                                                                                                                    |
| 4. Composer            | Attach a file, chips, progress, Remove, Send disabled with its hint. Copied only at first.                                                                                                                |
| 5. Linked              | The fingerprint, the find route and its bounded walk, the drag from a tool call card.                                                                                                                     |
| 6. Drop zone           | The overlay, its two texts, Esc.                                                                                                                                                                          |
| 7. Thread              | "Shared files", the badges, the notes, Copy the path.                                                                                                                                                     |
| 7b. `@` files          | The mention parser rule, the paths route and its cache, the Files group of the `@` list, the linked path on Send.                                                                                         |
| 8. Missing             | After question 4.                                                                                                                                                                                         |
| 9. Shared list         | Migration 8, the queries, `shareFiles()` on each message with files, the `files` event, `DELETE …/files/:fileId`, and the delete of a copy.                                                               |
| 10. `list_files`       | The MCP tool, `READ_TOOLS`, the member check, `exists`, the rule and the skill.                                                                                                                           |
| 11. Files panel        | The Files button and panel in a group chat and a channel, the section in the DM Files tab, Remove and its question, `Removed` in the thread.                                                              |

Docs in the same change: `docs/server.md` is at 249 lines, so the new routes
go into a split: `docs/server.md` stays as the index, with
`docs/server/routes.md` and `docs/server/files.md`. Also
`docs/conversations.md` (the prompt lines and the mention rule), `docs/agents.md` (`--add-dir`),
`docs/mcp.md` (the eighth tool), `docs/store.md` (migration 8 and the queries),
`docs/agent-environment.md`, `docs/web-app/conversation.md`,
`docs/web-app/session-panel.md`, `docs/README.md`, and
`docs/plans/design-boards.md`.
