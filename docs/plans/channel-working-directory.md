# A channel gives its folder to its agents

**Status:** awaiting go-ahead. The five questions and the place of the
scratch folder are decided (2026-11-15), and F37 is measured. No question is
open. The next step is the build, test-first.

## The idea

Today each agent has one folder (`agents.cwd`, the "Working directory" field
of the agent page). The folder is fixed to the agent, so an agent is fixed to
one project. To use a reviewer on two repositories, the user makes two
reviewer agents.

The idea moves the folder from the agent to the place where the work happens:

- An agent can be **generic**. It has no folder of its own. It is a role: a
  model, a permission mode, tools and a system prompt.
- A **channel** can have a folder. It is the project of that channel.
- An agent in a channel works in the folder of the channel. Add `reviewer` to
  `#web-app` and to `#billing-api`, and the one agent works in two
  repositories.

In this plan, "folder" is the working directory of a `claude` process. The
documents use the same word (`docs/agents.md`).

## Why the current shape makes this cheap

- **One session for each agent in each conversation** (`docs/architecture.md`).
  Each `claude` process already belongs to one agent and one conversation. So
  a process can take its folder from the conversation, and the sessions of one
  agent in two channels never share a process.
- **Each session row stores its configuration** (`agent_sessions.config`, with
  `cwd`). The session card already shows the folder of the session, not the
  folder of the agent (`sessionCard()` in `server/http/server.ts`).
- **An agent loads the project settings of its folder** (F23). In the folder
  of the channel, each agent gets the `CLAUDE.md`, the rules and the hooks of
  that project. This is the correct result for a project channel.

## F37: a resume works in another folder

Measured on 2026-11-15 with Claude Code 2.1.311 and `--model haiku`, for
0.018 USD. The row is in `docs/protocol.md`.

1. In folder A: "Remember the word kumquat." The answer was "OK".
2. In folder B: `--resume <id>`, "Which word did I ask you to remember?" The
   answer was "kumquat", with exit code 0 and no stderr.
3. The transcript stayed in the project folder of A. The new lines went into
   the same file, and each new line has the `cwd` of B. Claude Code also made
   an empty project folder for B, with only `memory/`.

So a folder change does not lose the memory of an agent. The server can
resume the old Claude session in the new folder. This is also what the server
does today when the folder of an agent changes: `liveSessionFor()` takes the
configuration of the agent at each new process.

## Decisions

1. **An agent with a folder in a channel with a folder uses the folder of the
   channel.** The channel is the project. The folder of the agent is its
   default for a DM, a group chat, and a channel with no folder. Rejected: the
   folder of the agent first, because the user cannot then see from the
   channel where each agent works.
2. **With no folder from anywhere, an agent works in a scratch folder.** The
   server makes `<scratch root>/<conversation id>` at the first process of
   that conversation. So a generic agent in a DM can chat, read the web, and
   write notes. A delete of the conversation deletes the scratch folder.
   Rejected: a refused turn with a notice, because a DM with a generic agent
   could then never work. Rejected: the folder of the server, the reason that
   the server refuses an empty `cwd` today (`docs/server.md`).
   - **The scratch root is outside this repository**:
     `~/.local/share/agent-chat/scratch`. The variable `AGENTS_SCRATCH`
     changes it, in the same way as `AGENTS_DATABASE` in `server/main.ts`.
     A test sets it to a temporary folder.
   - Rejected: `.data/scratch`, next to the database. It is inside this
     repository. Claude Code reads each `CLAUDE.md` in the parent folders of
     its folder, so the agent gets the rules of this project. A `git` command
     of the agent also acts on this repository.
   - Rejected: the temporary folder of the operating system. The system can
     delete it, and the agent then loses its notes.
3. **The folder of a channel can change, in Channel settings.** A running
   process keeps its folder. The next process of each agent starts in the new
   folder and resumes the same Claude session, because F37 shows that this
   keeps the memory. This is the same as a change to the configuration of an
   agent today. The session card shows "configuration changed" until then.
   The plan before F37 started a new Claude session at a change. F37 removed
   the reason for it.
4. **A group chat gets no folder in this change.** A group chat has no
   settings today (`docs/conversations.md`). It uses the folder of each agent,
   or the scratch folder.
5. **The folder of a channel is optional.** A channel for talk only needs no
   folder.

Also rejected:

- **A worktree for each agent in a channel.** It stops two agents from
  editing the same files at the same time. But it is a separate feature, with
  its own merge step. It can come after this change.
- **A folder on each membership** (`conversation_members.cwd`). It gives the
  most control, but the user must then set a folder for each agent in each
  channel, which is the problem this change removes.

## ERD

```
agents                                conversations
+-------------------------+           +-------------------------+
| PK id                   |           | PK id                   |
|    name, colour, model  |           |    kind, name, topic    |
|    permission_mode      |           |    private, reply_mode  |
|    cwd        CHANGED:  |           |    cwd   NEW, nullable  |
|      now nullable       |           |    created_at           |
|    autostart, ...       |           +-----------+-------------+
+-----------+-------------+                       |
            | 1:N                                 | 1:N
            |                         +-----------+-------------+
            |                         | conversation_members    |
            |                         | PK,FK conversation_id   |
            |                         |   ON DELETE CASCADE     |
            |                         | PK    member_key        |
            |                         | FK    agent_id          |
            |                         |   ON DELETE CASCADE     |
            |                         |    position, joined_seq |
            |                         +-------------------------+
            |
+-----------+-------------+
| agent_sessions          |   config (JSON) keeps "cwd": the folder that
| PK id                   |   the process started in. No change to the
| FK agent_id    CASCADE  |   column. Its value now comes from folderFor(),
| FK conversation_id      |   not from agents.cwd.
|                CASCADE  |
|    config, ...          |
+-------------------------+
```

- An agent has 0 or 1 folder. A conversation has 0 or 1 folder.
- A session has exactly 1 folder, in `config.cwd`, fixed when the process
  starts.
- Migration 8: add `conversations.cwd`. SQLite cannot remove `NOT NULL`, so
  the migration builds `agents` again with a nullable `cwd`. It needs no
  timeline rebuild.
- Only a channel can have a `conversations.cwd`. The routes refuse it for a
  DM and a group chat.

## Data flows

The folder of a process, in `liveSessionFor()` and in New session:

```
folderFor(agent, conversation)
  = conversation.cwd                     a channel with a folder
 ?? agent.cwd                            the default of the agent
 ?? scratchFolder(conversation.id)       AGENTS_SCRATCH/<id>, made if missing

liveSessionFor(agentId, conversationId)
  config = configOf(agent, folderFor(agent, conversation))
  createSession({ ..., claudeSessionId: earlier?.claudeSessionId, config })
  startSession({ cwd: config.cwd, ... })   a resume in a new folder is safe (F37)
```

- `configOf(agent)` becomes `configOf(agent, folder)`. The two callers and
  `sessionCard()` get the folder from `folderFor()`.
- `configChanged` compares the stored `config` with
  `configOf(agent, folderFor(...))`. So a change of the channel folder shows
  on the card.
- `sessionCard()` must not make the scratch folder. Only the start of a
  process makes it.
- The browser does not compute the folder. Each surface that shows a folder
  or shortens a path gets it from the server.

Where the folder shows, and where it comes from after the change:

| Surface                                    | Today        | After                          |
| ------------------------------------------ | ------------ | ------------------------------ |
| Session card, Directory                    | `config.cwd` | no change                      |
| Timeline paths and Files tab (`agent.cwd`) | the agent    | the folder of the session      |
| Conversation header, member list           | the agent    | the folder of the session      |
| Home page agent list (`model · cwd`)       | the agent    | the agent, or "No folder"      |
| `list_agents` tool, `folder`               | the agent    | the agent, or null             |
| `read_conversation` tool                   | no folder    | adds `folder` of the channel   |
| The rule, "# This session" block           | no folder    | adds "You work in ~/code/web." |
| Agent page, Command preview                | the agent    | text for a generic agent       |

## Workflows

**Make a generic agent.**

1. The user opens New agent and leaves Working directory empty.
2. The hint under the field says: "Empty: the agent works in the folder of
   each channel."
3. The server stores `cwd` as null. It does not refuse the empty field.

**Make a channel with a folder.**

1. Create channel has a new field, Working directory, with Browse. It uses
   the same folder dialog as the agent page.
2. The field is optional.
3. The server checks that the folder exists, with the same check as
   `GET /api/folders`. A missing folder gives `400` "The folder does not
   exist."

**Add an agent to the channel.** No new step. At its first turn, the process
starts in the folder of the channel.

**Change the folder of a channel.**

1. Channel settings has the field. A save sends `PATCH` with `cwd`.
2. A running process keeps its folder.
3. Each session card says "configuration changed".
4. At the next process of an agent (after New session, a stop, or a server
   start), the agent works in the new folder with its memory.

## The build

Test-first, with the `tdd` skill, one slice at a time. The seams:

1. **The store.** `createConversation({ cwd })`, `updateConversation(id,
   { cwd })`, `createAgent({ cwd: null })`. Migration 8 opens a version 7 file
   and keeps each row.
2. **The schemas** (`server/schemas.ts`). `agentSchema.cwd` becomes
   optional, empty as null. `channelSchema` gets `cwd`, empty as null.
   `channelSettingsSchema` picks it.
3. **The routes.** `POST /api/agents` with no `cwd` gives `201`.
   `POST /api/conversations` and `PATCH` for a channel take `cwd`. A test
   reads the `cwd` that the injected `startSession` gets
   (`server/test/http.ts`), for each line of `folderFor()`.
4. **The session card and the timeline folder.** The conversation response
   gives the folder of each agent session, so `timeline.tsx`, `files-tab.tsx`,
   `working-line.tsx` and the header stop reading `agent.cwd`.
5. **The rule and the tools.** `environmentPrompt()` adds the folder line.
   `list_agents` and `read_conversation` change as in the table.
6. **The web forms.** The agent page accepts an empty folder. Create channel
   and Channel settings get the folder field with Browse.

Then run `pnpm test`, `pnpm lint` and `pnpm build`, and run the app to see a
generic agent work in two channels.

**Documents to change when the code lands:** `docs/store.md` (migration 8,
the tables), `docs/server.md` (the routes, the refused empty `cwd`),
`docs/conversations.md` (channel settings), `docs/agents.md` (where the
folder comes from), `docs/agent-environment.md` (the folder line),
`docs/mcp.md`, `docs/forms.md`, `docs/web-app/agent-page.md`,
`docs/web-app/session-panel.md`, and the risks in `docs/architecture.md`.

## Risks

- **Two agents in one folder becomes the usual case.** Today the user chooses
  a folder for each agent, and two agents share a folder only by choice. In a
  channel with a folder, each agent shares it. The rule already says "Another
  agent can work in the same folder", but `docs/architecture.md` must move
  this risk up.
- **"Always allow" writes to the folder of the channel** (F21). A rule from
  one agent goes into `.claude/settings.local.json` of the project, so each
  agent in that folder gets it.
- **After a folder change, the memory of an agent holds old paths.** F37 keeps
  the memory, so the agent can try a path of the old folder. The folder line
  of the rule tells the agent where it works now.
- **Scratch folders stay on the disk.** A scratch folder is removed only when
  its conversation is deleted.
