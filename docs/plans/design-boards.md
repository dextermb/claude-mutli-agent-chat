# Make the app follow the design boards

**Status:** Tier 1 and Tier 2 are done and merged (2026-11-15). This plan
holds only the boards that need a feature of their own (Tier 3). Each one
needs its own plan before it is built. Done from Tier 3 on 2026-11-15:
Channel settings, the agent page, Browse for the working directory, the
Live mark of the Session log, the tabs on a phone (they moved into the
Session sheet), and file sharing with `@` file completion (2026-11-16).

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
- **People** (other humans, their names and presence, a name in place of
  "You", and people in Start a chat and Add members). The app runs locally,
  so it has only one user.

## Tier 3: still ahead

- **The rail pages** Direct messages and Activity. Their buttons are
  disabled with the tooltip "Not built yet".
- **The composer button** Run a slash command. Attach a file is built with
  file sharing.
