# The working line

This page gives the line at the end of the thread for each agent that works,
and the line over the message box while an agent works or waits.

While an agent is `busy`, `WorkingLines` shows one line for it at the end of
the thread. It is a `TraceLine` with `status="running"` and `role="status"`
(the `trace` and `spinner` components of the shadcn AI Elements). The line has
a spinner and the name of the agent, and its title shimmers. It says what the
agent does, from the last entry of that agent (not a call of a subagent):

| Last entry                         | Line                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| A `tool_call` that runs            | "test-runner is running Bash git push origin release-train" |
| A `message` that is still arriving | "test-runner is writing"                                    |
| Another entry, or none             | "test-runner is working"                                    |

After 3 s, the line also shows the time of the turn: "· 12 s", or
"· 2 min 32 s". `AgentWithState` has no turn start, so the start is the time
of the last `message` by another author before the first entry of the agent
after its last `turn` item. In a DM, this is the message of the user. The time
is `aria-hidden`, so a screen reader does not hear it each second.

A `waiting` agent gets no working line. Its approval card or question card
shows that it waits.

While an agent is `busy` or `waiting`, the header shows Stop, and a line over
the message box gives its state:

| State                       | Line                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `busy`                      | "test-runner is working. Your next message waits until this turn ends."            |
| `waiting`, for a permission | "test-runner needs your approval. Your next message waits until this turn ends."   |
| `waiting`, for a question   | "test-runner waits for your answer. Your next message waits until this turn ends." |
| `failed`                    | "test-runner stopped. Your next message starts it again and resumes the session."  |

An idle or stopped member has no line: the members panel shows its state
(`docs/web-app/session-panel.md`).
