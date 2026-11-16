# Make the app follow the design boards

**Status:** done (2026-11-16). Tier 1 and Tier 2 are merged (2026-11-15).
The rest of Tier 3 is dropped, so nothing is ahead. Done from Tier 3:
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
- **"Thought 4s"** on the AI Elements boards. The reducer drops `thinking`
  blocks, and Claude Code sends them with empty text and a signature only
  (`background.jsonl`). So the app has no reasoning to show.
- **Suggestions** under a done turn, **Edit** on a message of the user, and
  **Retry**, **Good response** and **Bad response** on a message of an agent
  (AI Elements boards). Nothing makes the suggestions, and the server has no
  action for the others.
- **A model menu in the message box** (AI Elements boards). The model is part
  of the agent configuration, so the message box links to it instead.
- **People** (other humans, their names and presence, a name in place of
  "You", and people in Start a chat and Add members). The app runs locally,
  so it has only one user.
- **The rail pages Direct messages and Activity** (dropped 2026-11-16). The
  sidebar lists each agent as a DM row, so a DM page shows the same list
  again. The unread counts and the footer ("1 needs approval") show what is
  new. The disabled rail buttons are removed.
- **The composer button Run a slash command** (dropped 2026-11-16). In a group
  chat or a channel, a message goes into a wrapped prompt (`[User] /compact`),
  so Claude Code never gets it as a command, and one command cannot go to
  more than one agent. The server sends `/compact` itself before an agent
  sleeps, and the model is part of the agent configuration.
