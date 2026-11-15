# Make the app follow the design boards

**Status:** Tier 1 and Tier 2 are done and merged (2026-11-15). This plan
holds only the boards that need a feature of their own (Tier 3). Each one
needs its own plan before it is built. Done from Tier 3 on 2026-11-15:
Channel settings, the agent page, Browse for the working directory, the
Live mark of the Session log, and the tabs on a phone (they moved into the
Session sheet).

Sources:

- Boards: the "Agent Chat" canvas, 21 boards
  (https://claude.ai/artifact/NyiP26udWrUFSDDX6BjutT).
- Design system: "Gruvbox Chat"
  (https://claude.ai/artifact/3cUXEWP7TNyCWaxnSe8fYu).

What shipped is in `docs/web-app/*.md`, `docs/server.md`, `docs/store.md` and
`docs/timeline.md`.

## Dropped

- **Counts on Grep and Glob ("3 matches", "6 files").** Claude Code 2.1.311
  has no Grep tool and no Glob tool. The `init` line of each fixture lists the
  tools, and neither is there. A recording on 2026-11-15 asked for both: the
  answer was "No such tool available: Grep", and the agent used `grep` and
  `find` through Bash. The boards show tools that the agents do not have.

## Tier 3: still ahead

- **File sharing** (the boards FileDrop, FileChips and FileInThread): a drop
  zone and chips in the composer, a link by path or by hash to a file in the
  folder of an agent, else a copy to the uploads of the conversation with
  `--add-dir`, and the shared files of a message in the thread.
- **People**: other humans, their names and presence, a name in place of
  "You", and people in Start a chat and Add members.
- **The rail pages** Direct messages and Activity. Their buttons are
  disabled with the tooltip "Not built yet".
- **The composer buttons** Attach a file and Run a slash command.
