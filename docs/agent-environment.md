# The environment of an agent

Each `claude` process gets a rule that tells the agent how the chat app
behaves, and facts that tell it where it is. Without the rule, an agent does
not know these facts:

- Its text is a chat message, and each text block is a separate message.
- A mention starts a turn of another agent, and each turn costs money.
- An approval card or a question card can wait for a long time.
- A question in the correct shape lets the user answer with no mention. The
  section "Questions to the user" gives the shape and how to ask well. The
  rule that the server applies is in `docs/conversations.md`.
- Each conversation is a separate session with a separate memory.
- Another agent can work in the same folder.

## The parts

| Part                                     | What it holds                                                   |
| ---------------------------------------- | --------------------------------------------------------------- |
| `agent/environment.md`                   | The static rule: the behaviour of the chat app                  |
| `ENVIRONMENT_RULE`                       | The text of `agent/environment.md`                              |
| `agent/compact.md`                       | The instructions of `/compact` before a sleep (`docs/sleep.md`) |
| `sessionFacts()`                         | The facts of the session: one line for each fact                |
| `factsNote(sent, now)`                   | The block of facts that goes before the next prompt             |
| `agent/.claude-plugin/plugin.json`       | The `chat` plugin, which `--plugin-dir` loads                   |
| `buildArgs(agent, session, environment)` | The rule, then the system prompt of the agent                   |

These are in `server/session/environment-prompt.ts`. The server reads
`agent/environment.md` one time, when it starts. So a change to the file
needs a restart of the server.

The rule goes into the system prompt, because it never changes. The facts go
into the prompt, because they change: a resume keeps the system prompt of
the first process (F40 in `docs/protocol.md`). So the system prompt of one
agent is the same in each conversation.

## The facts of the session

The first prompt of each process starts with a block of facts. It is a
separate text block, before the text of the messages:

```
[Chat app] This session:
- You are the agent "test-runner".
- This conversation is the channel "#release-train" (ID "…"). Its topic: "Ship v2.4 on Friday.".
- An agent gets a turn when a message mentions it with @name. If your message asks a question and mentions no agent, the next message of the user with no mention also comes to you.
- The members: User, reviewer-bot, test-runner (you).
- You work in ~/code/release, the folder of this channel. Each agent of this channel works in the same folder.
```

| Kind and reply mode | The line about turns                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM                  | You get each message of the user. A mention does nothing here.                                                                                                                     |
| `mention`           | An agent gets a turn when a message mentions it with @name. If your message asks a question and mentions no agent, the next message of the user with no mention also comes to you. |
| `every`             | Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name.                                                       |

The rule in `agent/environment.md` also tells the agent what the lines
`[Shared file: <path>]` and `[Removed file: <path>]` mean, and names
`list_files`. The skill `chat:catch-up` calls `list_files` when a message
refers to a file that the prompt does not show.

These lines follow the rules in `docs/conversations.md`. When those rules
change, change `sessionFacts()` and `agent/environment.md` too.

The last line gives the folder of the process, with `~`. It comes from
`folderFor()` (`docs/agents.md`):

| Folder from | The line                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| The channel | You work in `<folder>`, the folder of this channel. Each agent of this channel works in the same folder.   |
| The agent   | You work in `<folder>`.                                                                                    |
| Scratch     | You work in `<folder>`, a scratch folder of this conversation. It holds no project. Keep your notes there. |

The line about the channel matters most. Without it, an agent in a channel
does not know that the other agents edit the same files.

## When the facts change

The server makes the facts again before each prompt, and compares them with
the facts that it sent last to that process. Only the lines that changed go
before the next prompt:

```
[Chat app] This session changed:
- The members: User, reviewer-bot, test-runner (you), docs-writer.
```

- A change of the members, the name, the topic or the reply mode reaches the
  agent with its next prompt.
- When nothing changed, the prompt has no block of facts.
- The folder line gives the folder of the process. A process keeps its
  folder until it stops, so this line changes only in a new process.
- The server keeps the facts that it sent in memory, for each process. A new
  process, also one that resumes a Claude session, gets the full block again.
- The same block can also hold the length of a sleep, the number of messages
  that the prompt leaves out, and the note of a new session after a lost
  transcript (`docs/sleep.md`).

## The data flow

```
start(row)                                   server/http/server.ts
  -> buildArgs(agent, row, ENVIRONMENT_RULE)
       --plugin-dir <repository>/agent
       --append-system-prompt "<rule>\n\n<system prompt of the agent>"
  -> startSession({ args, … })

deliverNext(session)                         when the process is idle
  -> sessionFacts({ agentName, conversation, memberNames, folder })
  -> factsNote(the facts sent last, the facts of now)
  -> handle.prompt(text, note)               two text blocks: note, text
```

The members are the names that the prompt uses: `User` for the user, and the
name of each agent.

## The plugin

`--plugin-dir` loads the `agent/` folder as the plugin `chat` (F33 in
`docs/protocol.md`). A skill in `agent/skills/<name>/SKILL.md` shows as
`chat:<name>`. The plugin does not hold the rule, because a plugin cannot
give a `CLAUDE.md`, and a skill loads only on demand.

| Skill               | When the agent uses it                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| `chat:ask-an-agent` | It needs work or an answer from another agent: where to ask, and where the answer comes |
| `chat:hand-off`     | Another agent must continue a task: the shape of a complete brief                       |
| `chat:catch-up`     | Its prompt does not tell it enough: read the earlier messages first                     |

The skills use the tools of the `chat` MCP server (`docs/mcp.md`). The
section "The chat tools" of `agent/environment.md` lists those tools, so the
agent knows them in each turn. When a tool changes, change that section and
the skills too.
