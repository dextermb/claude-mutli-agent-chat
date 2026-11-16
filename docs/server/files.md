# Shared files and folders

This page holds the routes that read the disk: the uploads, the shared files
of a conversation, the `@` search of paths, and the folders of Browse. The
user-facing side is in `../web-app/conversation.md`.

## Two kinds of shared file

- `linked`: a real file in the folder (`cwd`) of an agent member. An agent
  that changes it changes the project.
- `copied`: a file in the uploads of the conversation,
  `<uploads>/<conversation id>/<name>`. The uploads folder is
  `AGENTS_UPLOADS`, by default `uploads/` next to the database. Each process
  gets `--add-dir` for the uploads of its conversation, and the server makes
  that folder before it starts the process, so a later copy is readable with
  no restart (F37 in `../protocol.md`).

## Uploads

`PUT /api/conversations/:id/uploads?name=<name>` takes the raw bytes
(`saveUpload()` in `server/http/uploads.ts`). It keeps only the base name of
`name`, and a name that exists gets ` (2)`, ` (3)` before its extension. The
limit is 25 MB (`uploadLimit` of `createServer()`): a larger body gets `413`
"The limit is 25 MB.", and the part that was written is deleted.

## Find a dropped file

A browser does not give the path of a dropped file. So the browser sends
`{ name, size, sha256 }` to `POST /api/conversations/:id/files/find`.
`findFile()` in `server/http/find-file.ts` walks the folder of each agent
member, takes the files with the same name and size, and hashes only those.
The most recently changed match wins. No match gives `{ match: null }`, and
the browser then uploads the file.

The walk (`walk()` in `server/http/paths.ts`) skips names that start with
`.`, and `node_modules`, `dist`, `build` and `target`. It stops after 50,000
entries or 2 s for each folder. A walk that stops finds less, so a file is
copied that could have been linked. Nothing breaks.

## Share files with a message

`POST /api/conversations/:id/messages` also takes
`files: [{ name, path, kind, size }]` (`checkFiles()` in
`server/http/shared-files.ts`). A `linked` path must be a file inside the
folder of an agent member. A `copied` path must be a file inside the uploads
of the conversation. Else `400` "<name> is not a file that this conversation
can share.". The server takes the size from the disk. A message can have
files and no text.

The message item keeps its `files`. The prompt gets one line
`[Shared file: <path>]` for each file after the text
(`../conversations.md`), and `read_messages` gives the `files` too
(`../mcp.md`).

## The list of shared files

Each conversation has one list, the table `shared_files` (`../store.md`). A
message with files adds them. The list is a set of paths: a second share of
the same path updates the row, and puts back a removed file.

- `GET /api/conversations/:id/files` gives each row, removed ones too, with
  `sharedBy` as a name and `exists` (the path is a file now).
- `DELETE /api/conversations/:id/files/:fileId` sets `removed_at`. A `copied`
  file is deleted from the uploads. A `linked` file is never touched. The
  next prompt of each agent member starts with `[Removed file: <path>]`. The
  server keeps these lines in memory, so a server start loses the ones that
  were not sent yet.
- After each change, the stream of the conversation sends
  `{ type: "files", files }` with the full list.
- `list_files` of the chat MCP server gives the rows that are not removed
  (`../mcp.md`).

## Paths for `@`

`GET /api/conversations/:id/paths?q=<text>` gives the best 20 files of the
agent folders whose relative path holds the text, as
`{ path, relative, agentId }` (`searchPaths()` in `server/http/paths.ts`). A
shorter path ranks first, then a name that starts with the text. In a git
repository the list comes from
`git ls-files --cached --others --exclude-standard`, so `.gitignore` applies.
Else it comes from the walk above. The server keeps the list of each folder
for 30 s.

## Folders for Browse

`GET /api/folders` serves Browse on the agent page. `listFolders()` in
`server/http/folders.ts` reads one folder:

- `folders` holds each subfolder as `{ name, path }`, in alphabetical order.
  A symbolic link to a folder counts. Files and names that start with `.`
  are left out.
- `path` is the folder that was read, and `parent` the folder above it, or
  `null` at `/`.
- A path that is not absolute gets `400` "Give an absolute path.", a missing
  path `404` "The folder does not exist.", a file `400` "The path is not a
  folder.", and a folder that the operating system refuses `400` "The server
  cannot read this folder.".

The route has no root folder. The server listens only on `127.0.0.1`, and an
agent can already run shell commands in each folder that it can reach.
