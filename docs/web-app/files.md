# Shared files in the web app

This page tells how the user shares a file, and where the shared files show.
The routes and the rules of the server are in `docs/server/files.md`. Each
part uses the shadcn/ui components of `src/components/ui`.

## The composer

`useAttachments(conversationId)` (`src/hooks/use-attachments.ts`) keeps the
chips of the message. The page owns it, because the composer, the drop zone
and the `@` list all add to it.

- **Attach a file** (the paperclip) opens the file input of the browser with
  `multiple`.
- Each file first gets the chip `Finding`. The browser computes the SHA-256
  of the file and asks `POST …/files/find`. A match gives `Linked` with the
  path. Else `src/lib/upload.ts` copies the file with `XMLHttpRequest`, for
  its progress: `Copy: 60%` with a `Progress` bar, then `Copied` with the
  path in the uploads. A failure gives `Failed`, "The copy did not work.",
  with Retry.
- A folder gets `Refused`: "A folder cannot be shared. Drop the files in
  it.".
- The chips are a list, "Files for this message", over the text. Each chip
  has "Remove <name>". While a chip is `Finding`, `Copy`, `Refused` or
  `Failed`, Send is disabled, and the hint says why: "Send waits until
  <name> is shared.", "Remove the folder to send." or "Retry or remove
  <name> to send.".
- Send posts `{ text, files }`. A message can have files and no text. The
  chips then clear.

## The drop zone

`useDropZone()` (`src/components/conversation/drop-zone.tsx`) works on the
Messages panel. A drag with `Files` or `application/x-agent-path` shows a
dashed region named "Drop zone" over the thread:

- From the disk: "Drop to share with <name>", the notes Linked and Copied,
  and "Press Esc to cancel.".
- From the app: "Drop to add <path>". The path of a tool call card with a
  `file_path` can be dragged (`src/lib/drag-path.ts`). A drop adds a
  `Linked` chip with no request.
- Esc, or a drag that leaves the page, hides it. A drop adds the chips. A
  test uses `fireEvent` with a fake `dataTransfer` here, because
  `user-event` cannot drag and drop.

## `@` completes files

After `@`, the list shows the group "Members" and, once the user types a
character, the group "Files": the best 20 paths of `GET …/paths`, each with
its relative path and its agent. They are two listboxes, and the text box
names both in `aria-controls`, so Up and Down move through both. A pick
inserts `@<relative path> ` and adds a `Linked` chip, so the file is shared
with the message, and Claude Code also attaches its content (F38 in
`docs/protocol.md`). Removing the text keeps the chip: Remove takes it off.

## In the thread

A message with files shows the list "Shared files" under its text
(`src/components/conversation/shared-files.tsx`). Each row has the name, a
badge, the path in mono, a note and "Copy the path of <name>":

| Badge     | When                              | Note                                                         |
| --------- | --------------------------------- | ------------------------------------------------------------ |
| `Linked`  | A real file of an agent folder    | The last action of an agent after the message                |
| `Copied`  | A copy in the uploads             | The same                                                     |
| `Removed` | The user removed it from the list | "Removed from the shared files at 14:20."                    |
| `Missing` | The path is gone from the disk    | "The file is not there any more. Drop it again to share it." |

The note of an action comes from `fileNote()` in `src/lib/files.ts`: the
last `Edit` or `Write` of the path ("Edited by test-runner at 14:05"), else
the last `Read` ("Read by …"), else "No agent read it yet.". A removed copy
and a missing file have no Copy button.

## The list of shared files

`useConversation()` loads `GET …/files` with the conversation, and follows
the `files` event. A failed load gives an empty list, so the page still
loads.

- **A group chat or a channel:** a button in the header with a folder icon
  and the count ("Shared files: 2") opens the panel "Shared files"
  (`files-panel.tsx`), an `aside` of 360 px or a `Sheet` below 768 px. It
  and the members panel close each other.
- **A DM:** the Files tab starts with the section "Shared files".
- Each row says "Shared by User at 14:03 · <note>", with Copy the path and
  "Remove <name>". Remove of a linked file acts at once. Remove of a copy
  asks first: "Remove ci-log.txt?", "The copy in the uploads is deleted. The
  message keeps its name.".
- An empty list shows "No files are shared here yet. Drop a file on the
  conversation to share it." in an `Empty`.
