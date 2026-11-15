# The Claude Code stream

The server drives each agent as a `claude` child process in headless mode. The
two processes exchange one JSON object for each line. This page records what
Claude Code **2.1.311** does on that channel, as measured on 2026-11-15.

The stream changes between versions. Record the fixtures again after an
upgrade (see "The fixtures"), and compare them with this page.

## The command line

```
claude -p
  --input-format  stream-json
  --output-format stream-json
  --verbose
  --include-partial-messages
  --replay-user-messages
  --permission-prompt-tool stdio
  --setting-sources user,project
  --model <model>
  --permission-mode <mode>
  [--resume <session_id>]
```

- `--verbose` is necessary. Claude Code refuses `--output-format stream-json`
  under `-p` without it.
- `--permission-prompt-tool stdio` sends each permission request and each
  question to the host on stdout (F2, F6).
- `--setting-sources user,project` gives the agent the user's settings, MCP
  servers, memory files and hooks, the same as a terminal session.

`buildArgs()` in `server/session/args.ts` makes this command line. See
`docs/agents.md`.

## The environment of the child

A `claude` process that runs inside another Claude Code session gets the
variables of that session. Remove them before the child starts, so that the
child is a new session and does not get the token of the parent:

`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_CHILD_SESSION`,
`CLAUDE_CODE_EXECPATH`, `CLAUDE_CODE_MESSAGING_SOCKET`,
`CLAUDE_CODE_MESSAGING_TOKEN`, `CLAUDE_CODE_SESSION_ATTENDED`,
`CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID` and `CLAUDE_EFFORT`.

Keep each other `CLAUDE_CODE_*` variable, because the user can set one on
purpose, for example to select a provider. `childEnvironment()` in
`server/session/environment.ts` removes them, and the recorder uses it too.

## Input lines

| Line | Use |
|---|---|
| `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"…"}]},"parent_tool_use_id":null}` | A prompt |
| `{"type":"control_request","request_id":"…","request":{"subtype":"initialize"}}` | The first line. The answer lists the commands and the account |
| `{"type":"control_response","response":{"subtype":"success","request_id":"<id of the request>","response":{…}}}` | The answer to `can_use_tool` |
| `{"type":"control_request","request_id":"…","request":{"subtype":"interrupt"}}` | Stops the turn |
| `{"type":"control_request","request_id":"…","request":{"subtype":"set_model","model":"…"}}` | Changes the model. Taken from the multiplexer, not measured again |
| `{"type":"control_request","request_id":"…","request":{"subtype":"set_permission_mode","mode":"…"}}` | Changes the mode. Taken from the multiplexer, not measured again |

The answer to `can_use_tool` is one of these:

```json
{"behavior": "allow", "updatedInput": {…}, "updatedPermissions": [ … ]}
{"behavior": "deny", "message": "The user denied this command."}
```

`updatedPermissions` is optional. It holds the `permission_suggestions` of the
request that the user accepts.

## Findings

The fixture column names a file in `server/protocol/fixtures`. A finding with
"probe" as evidence comes from a probe that is not in the repository.

| # | Finding | Evidence |
|---|---|---|
| F1 | One JSON object for each line. `system/init` comes after the first input. The main types are `assistant`, `user`, `result` and `stream_event`. | Each fixture |
| F2 | Claude Code sends `control_request` with the subtype `can_use_tool` on stdout. The turn waits for the `control_response` on stdin. | `tools` |
| F3 | The request carries `tool_name`, `input`, `tool_use_id`, `description` and `permission_suggestions`. | `tools` |
| F4 | **"Always allow" can grant more than the user sees.** The only suggestion for `Write` and `Edit` is `setMode acceptEdits` for the session. After that mode, a later `rm` ran with no request. | Probe |
| F5 | Read-only commands (`echo`, `Read`) need no request in the `default` mode. `Write`, `Edit` and `rm` send a request. | `tools` |
| F6 | **`AskUserQuestion` goes through `can_use_tool` too.** The host answers with `updatedInput.answers`, a map from the question text to the chosen label. The turn then continues. | `question` |
| F7 | A tool result line carries `tool_use_result`, a structured result. `Read` gives `file.numLines`. `Edit` gives `structuredPatch`. `Write` gives `type: "create"`. `Bash` gives `stdout`, `stderr` and `interrupted`. | `tools` |
| F8 | A tool result line carries `tool_result_meta[].permission_decision`, with `decision` (`accept` or `reject`) and `source` (`config`, `user_temporary` or `user_reject`). | `tools` |
| F9 | A denied call returns a `tool_result` with `is_error: true` and the deny message. The `result` line lists it in `permission_denials`. | `tools` |
| F10 | `interrupt` answers `{still_queued: []}`. The turn ends with a `user` line `[Request interrupted by user]` and a `result` with the subtype `error_during_execution` and `terminal_reason: "aborted_streaming"`. The process stays alive. | `interrupt` |
| F11 | **A turn can start with no prompt.** When a background job completes, Claude Code runs a new turn, which ends with a second `result`. | `background` |
| F12 | `--resume <session_id>` in a new process keeps the memory and the session ID. It does not write the old messages to stdout again. | `resume-1`, `resume-2` |
| F13 | The transcript that Claude Code writes (`~/.claude/projects/<dir>/<id>.jsonl`) has an internal shape (`api-request`, `attachment`, `queue-operation`), not the stream-json shape. | Probe |
| F14 | Text arrives in small pieces of 8 to 22 characters on average. The multiplexer measured 150 characters on an older version. | `interrupt` |
| F15 | `system/init` comes again at the start of each turn. | `background` |
| F16 | With `--replay-user-messages`, Claude Code writes back each `control_response` that the host sends. | `tools` |
| F17 | Many other line types arrive: `system/status`, `system/thinking_tokens`, `system/commands_changed`, `system/background_tasks_changed`, `system/task_*` and `rate_limit_event`. | Each fixture |
| F18 | `total_cost_usd` on a `result` counts from the start of the process. A resumed process starts again from zero. | Probe |
| F19 | The Agent SDK package is 5.4 MB, and its macOS binary package is 347 MB. | `npm view` |
| F20 | **A `can_use_tool` request has no time limit.** A probe answered after 12 minutes, and the turn then completed. | Probe |
| F21 | **"Always allow" can write a rule to a file.** For `rm`, the suggestions are `addRules` with the destination `localSettings`, `addDirectories` and `setMode`. The `localSettings` rule goes into `.claude/settings.local.json` in the agent's folder, so it stays after the session. | `tools` |
| F22 | The lines of a subagent carry `parent_tool_use_id`, set to the id of the `Agent` call. The lines of the main agent carry `null`. | `subagent` |
| F23 | With the user settings, `SessionStart` hooks send `system/hook_started` and `system/hook_response` lines **before** `system/init`. | Each fixture |
| F24 | `system/commands_changed` carries the full list of the user's commands and skills. | Each fixture, cleared |
| F25 | Claude Code answers `initialize` about 1 s after the start, before any prompt and with no `system/init`. When stdin closes and no turn runs, the process exits with code 0. | Probe |

## The decoder and the encoders

`server/protocol/decode.ts` turns one line into one typed line. It
never throws. A line that is not a JSON object is `invalid`, and a line of a
kind that the app does not read is `unknown` with the raw object.

| `kind` | From |
|---|---|
| `init` | `system/init` |
| `assistant` | `assistant`, with its `text` and `tool_use` blocks. Other blocks, such as `thinking`, are dropped |
| `tool_results` | `user` with `tool_result` blocks, with `tool_use_result` and the permission decision |
| `prompt_echo` | `user` with `isReplay: true` |
| `text_delta` | `stream_event` with a `text_delta` |
| `permission_request` | `control_request` with the subtype `can_use_tool` |
| `permission_answer` | `control_response` with an `allow` or `deny` answer: the line that the server sends, or its echo on stdout (F16) |
| `result` | `result` |
| `task` | `system/task_started`, `task_updated` and `task_notification` |
| `rate_limit` | `rate_limit_event` |

A `tool_results` line gives `structured` (the `tool_use_result`) only when it
holds one result, because that field belongs to the whole line.

`server/protocol/encode.ts` writes the input lines of the table above: a
prompt, `initialize`, `interrupt`, and the answer to a permission request.

`docs/timeline.md` tells how the decoded lines become timeline items.

## The fixtures

`server/protocol/fixtures` holds one file for each scenario, recorded with the
Haiku model. Each line is `{"dir": "in" | "out", "line": {…}}`. `in` is a line
that the recorder wrote to stdin, and `out` is a line that Claude Code wrote
to stdout.

| File | What it holds |
|---|---|
| `tools.jsonl` | `Read`, a `Read` of a missing file, `echo`, `Edit` (allowed once), `rm` (denied), `Write` (always allowed) |
| `question.jsonl` | An `AskUserQuestion` call, answered with the first option |
| `interrupt.jsonl` | A long answer, interrupted after the first text piece |
| `resume-1.jsonl`, `resume-2.jsonl` | A first process, and a second process with `--resume` |
| `background.jsonl` | A background `Bash` job, and the turn that it starts with no prompt |
| `subagent.jsonl` | An `Agent` call and the lines of the subagent |

To record them again:

```sh
pnpm fixtures:record                       # each scenario
pnpm fixtures:record server/protocol/fixtures interrupt   # one scenario
```

The recorder (`scripts/record-fixtures.ts`) costs about 0.06 USD for each
full run. It uses a fixed work folder, `/tmp/claude-fixture/<scenario>`, so
that no path of the machine gets into a file. Before it writes a file, it:

- replaces the home folder with `/home/user`, and `/tmp/claude-<uid>/` with
  `/tmp/claude/`,
- clears the lists in `system/init` that name the user's skills, commands,
  plugins, agents and memory files, and removes `mcp__` tools,
- renames each MCP server to `server-<n>`,
- clears `system/commands_changed` and the answer to `initialize`.

After a new recording, search the files for the user name, the home folder
and the names of the user's plugins before the commit.

## Not measured

- `set_model` and `set_permission_mode` on this version.
- `--max-turns`. The help of 2.1.311 does not list it.
- Two permission requests that are open at the same time.
- Two sessions that write to the same folder at the same time.
