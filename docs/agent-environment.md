# The environment of an agent

Each `claude` process gets a rule that tells the agent where it is and how
the chat app behaves. Without the rule, an agent does not know these facts:

- Its text is a chat message, and each text block is a separate message.
- A mention starts a turn of another agent, and each turn costs money.
- An approval card or a question card can wait for a long time.
- Each conversation is a separate session with a separate memory.
- Another agent can work in the same folder.

## The parts

| Part                                     | What it holds                                  |
| ---------------------------------------- | ---------------------------------------------- |
| `agent/environment.md`                   | The static rule: the behaviour of the chat app |
| `environmentPrompt()`                    | The facts of the session, then the static rule |
| `agent/.claude-plugin/plugin.json`       | The `chat` plugin, which `--plugin-dir` loads  |
| `buildArgs(agent, session, environment)` | The rule, then the system prompt of the agent  |

`environmentPrompt()` is in `server/session/environment-prompt.ts`. It reads
`agent/environment.md` one time, when the server starts. So a change to the
file needs a restart of the server.

## The facts of the session

The rule starts with a block that the server makes for the conversation:

```
# This session

- You are the agent "test-runner".
- This conversation is the channel "#release-train" (ID "…"). Its topic: "Ship v2.4 on Friday.".
- An agent gets a turn only when a message mentions it with @name.
- The members at the start: User, reviewer-bot, test-runner (you).
```

| Kind and reply mode | The line about turns                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| DM                  | You get each message of the user. A mention does nothing here.                                                               |
| `mention`           | An agent gets a turn only when a message mentions it with @name.                                                             |
| `every`             | Each agent gets each message of the user. A message of an agent gives a turn only to the agents that it mentions with @name. |

These lines follow the rules in `docs/conversations.md`. When those rules
change, change `environmentPrompt()` and `agent/environment.md` too.

The block tells what was true when the process started. A change to the
members or to the channel settings does not reach a process that runs. The
next process of the agent gets the new values.

## The data flow

```
start(row)                                   server/http/server.ts
  -> environmentPrompt({ agentName, conversation, memberNames })
  -> buildArgs(agent, row, rule)
       --plugin-dir <repository>/agent
       --append-system-prompt "<rule>\n\n<system prompt of the agent>"
  -> startSession({ args, … })
```

The members are the names that the prompt uses: `User` for the user, and the
name of each agent.

## When the rule changes

The server makes the rule only when a process starts. So:

- An agent that joins or leaves does not change the rule of a process that
  runs. The rule says "the members at the start" for this reason.
- A process that resumes a Claude session gets the rule of now. A new system
  prompt is valid with `--resume`, but the first turn loses the prompt cache.

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
