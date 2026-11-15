# Agent sessions

An agent session is one `claude` process for one agent in one conversation.
`server/session` starts the process, writes its input lines, and reads its
output. The browser never talks to the process.

## The command line

`buildArgs(agent, session, context)` in `server/session/args.ts` gives the
arguments of `claude`. It fills the values of the session (the plugin folder,
the `--mcp-config` with the token, and the rule) into `claudeArgs()` in
`server/session/claude-args.ts`. That module imports nothing from Node, so the
Command preview of the agent page uses the same function with placeholders in
place of these values (`docs/web-app/agent-page.md`). The token never reaches
the browser. The fixed part is in `docs/protocol.md`. The agent configuration
adds the rest:

| Field              | Argument                                                             |
| ------------------ | -------------------------------------------------------------------- |
| `model`            | `--model <model>`                                                    |
| `permissionMode`   | `--permission-mode <mode>`                                           |
| `allowedTools`     | `--allowedTools <rule> …`, then the read tools of the chat server    |
| `disallowedTools`  | `--disallowedTools <rule> …`, if the list has one                    |
| `systemPrompt`     | `--append-system-prompt <rule>\n\n<prompt>`, or the rule only        |
| `claudeSessionId`  | `--resume <id>`, if the session has one                              |
| `claudeSessionNew` | With a Claude session ID: `--session-id <id>` in place of `--resume` |
| `maxTurns`         | `--max-turns <n>`, if the agent has a limit (F36)                    |

`claudeSessionNew` is true for an ID that the server chose and that has had
no turn yet. Before the first turn, `--resume` of that ID fails (F30). After
it, `--session-id` of that ID fails (F31). So the server clears the flag at
the first `system/init`.

The third argument of `buildArgs()` is the rule of the environment
(`docs/agent-environment.md`). The rule and the system prompt of the agent go
after the default prompt of Claude Code, so the agent keeps the guidance for
its tools. Each session also gets `--plugin-dir` with the `agent/` folder of
the repository, and `--mcp-config` with the `chat` MCP server and the token of
the session (`docs/mcp.md`).

The folder of the agent is the `cwd` of the process, not an argument.

## The session

```ts
const session = new AgentSession({ command, args, cwd, env, onEvent })
session.start()
session.prompt(text)
session.answer(requestId, answer) // a PermissionAnswer, see encode.ts
session.interrupt()
await session.stop()
```

`AgentSession` in `server/session/session.ts` removes the variables of a
parent Claude Code session from `env` before it starts the process (see
`docs/protocol.md`).

### States

```
start()                      -> starting
answer to initialize         -> idle      (F25: before any prompt)
prompt()                     -> busy
permission_request           -> waiting   (a permission or a question, one at a time: F26)
echo of the answer           -> busy
result                       -> idle      (also after an interrupt)
exit after stop()            -> exited    (also after a signal)
exit with code 0             -> exited
exit with another code       -> failed
```

After `exited` or `failed`, the session drops each prompt, answer and
interrupt. It does not write to the closed stdin of the process.

### Events

`onEvent` gets each event in order:

| Event                                         | When                                                              |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `{ type: "state", state }`                    | The state changes                                                 |
| `{ type: "line", direction, text }`           | Each line that the session writes (`in`) or reads (`out`)         |
| `{ type: "changes", items }`                  | A stdout line adds or changes timeline items (`docs/timeline.md`) |
| `{ type: "claude_session", claudeSessionId }` | `system/init` gives the Claude session ID                         |
| `{ type: "exit", code, signal, stderr }`      | The process ended. It comes before the last `state` event         |

The `line` events go to `session_events` without a change, also a line that
is not JSON. So the timeline can be built again from the stored lines.

### Stop and stderr

`stop()` closes stdin and waits for the exit. After `stopTimeoutMs` (default
5000), it sends `SIGTERM`. After `stopTimeoutMs` again, it sends `SIGKILL`.
So a process that does not stop delays the shutdown of the server by 10 s at
most.

The session reads stderr all the time, so a process that writes much to
stderr cannot block on a full pipe. It keeps the last 4 KB for the `exit`
event. The event comes on `close`, not on `exit`, so it holds the last bytes.

`system/init` comes only after the first prompt, and again at the start of
each turn (F15). Store the Claude session ID from the first one, so that the
next process can `--resume` it.

## The fake `claude`

`server/test/fake-claude.ts` is a Node script that plays a recorded fixture.
The tests start it in place of `claude`:

- It writes each `out` line of the fixture.
- At each `in` line, it waits for a line on stdin of the same type.
- It answers `initialize` at once, as Claude Code does (F25).
- It gives each control answer the request ID that the session sent.

`FAKE_CLAUDE_FIXTURE` names the fixture. `FAKE_CLAUDE_MODE` selects a mode:

| Mode       | At the first prompt, the fake …                                                           |
| ---------- | ----------------------------------------------------------------------------------------- |
| `play`     | plays the fixture                                                                         |
| `crash`    | writes `fake claude (crash): crash on the first prompt` to stderr, then exits with code 1 |
| `not-json` | writes a line that is not JSON, then plays the fixture                                    |
| `env`      | writes the names of its `CLAUDE*` variables, then plays the fixture                       |
| `hang`     | plays the fixture, but ignores the end of stdin and `SIGTERM`                             |

With `FAKE_CLAUDE_REPLY`, the fake replaces the text of each reply with that
text, and leaves out the text pieces.
