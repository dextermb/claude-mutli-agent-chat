---
name: shared-files
description: Use when your prompt holds a [Shared file: …] or a [Removed file: …] line. It tells you where the file is, whether a change to it changes a project, and how to see each shared file.
---

# Shared files

- A line `[Shared file: /path]` after a message gives a file that the user
  shared with that message. Read it at that path.
- A `copied` file is in the uploads of the conversation. You can read it, and
  a change to it changes only the copy.
- A `linked` file is the real file of a project. A change to it changes the
  project, so say so before you change it.
- A line `[Removed file: /path]` tells you that the user took a file off the
  shared list. Stop using it. A removed copy no longer exists.
- Call `list_files` for each file that is shared in a conversation now, with
  its kind.
