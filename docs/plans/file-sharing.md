# File sharing

**Status:** awaiting go-ahead. Nothing is built. The decisions below are
proposals. Six questions are open.

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
6. **Old uploads.** Nothing deletes them. My recommendation: leave them.
   They are small, and an agent may still need one. A later change can add a
   clean-up.

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

Process start
  └─ mkdir <uploads>/<conversation id>
  └─ claudeArgs(..., { addDir }) ─▶ --add-dir <uploads>/<conversation id>
```

No table changes. The JSON in `timeline_items.payload` of a user message
gains `files: [{ name, path, kind, size }]`.

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

## The build

Test-first, one slice at a time. The seams: `createServer()` for the routes,
`buildArgs()` for `--add-dir`, the conversation page for the composer and the
thread, and `filesOf()` for the notes.

| Slice                  | Content                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Live check          | One recording with `--add-dir` (about 0.01 USD): a `Read` of a file in the added folder, in `default` mode, with no permission request. If it asks, decision 6 changes. |
| 1. Uploads             | `AGENTS_UPLOADS`, the upload route, safe names, the size limit.                                                                                                         |
| 2. `--add-dir`         | The folder at the process start, `claudeArgs()`, the preview.                                                                                                           |
| 3. Messages with files | The message route, the checks, `MessageItem.files`, the prompt lines, `read_messages`.                                                                                  |
| 4. Composer            | Attach a file, chips, progress, Remove, Send disabled with its hint. Copied only at first.                                                                              |
| 5. Linked              | The fingerprint, the find route and its bounded walk, the drag from a tool call card.                                                                                   |
| 6. Drop zone           | The overlay, its two texts, Esc.                                                                                                                                        |
| 7. Thread              | "Shared files", the badges, the notes, Copy the path.                                                                                                                   |
| 8. Missing             | After question 4.                                                                                                                                                       |

Docs in the same change: `docs/server.md` is at 249 lines, so the new routes
go into a split: `docs/server.md` stays as the index, with
`docs/server/routes.md` and `docs/server/files.md`. Also
`docs/conversations.md` (the prompt lines), `docs/agents.md` (`--add-dir`),
`docs/mcp.md`, `docs/web-app/conversation.md`, `docs/README.md`, and
`docs/plans/design-boards.md`.
