# The conversation

A conversation is a DM, a group chat or a channel. This page gives the hook
that holds a conversation, the parts of its timeline, and the header and
message box of a group chat or a channel.

## `useConversation(id)`

`src/hooks/use-conversation.ts` holds one conversation:

1. It loads `GET /api/conversations/:id` (the conversation, its agents and
   the state of each agent) and `GET /api/conversations/:id/timeline`.
2. It opens an `EventSource` on `/api/conversations/:id/events?lastEventId=<n>`,
   with the `lastEventId` of the timeline. So no event goes missing between
   the two requests. After a lost connection, the browser sends
   `Last-Event-ID` itself.
3. An `item` event replaces the entry with the same ID, or adds it at the end.
   An `agent_state` event changes the state of that agent. A `conversation`
   event replaces the conversation and loads its agents again. A `reset`
   event closes the stream and starts again from step 1.
4. It closes the stream when the page goes away.

It gives `status`, `conversation`, `agents`, `entries`, and three actions:
`send(text)`, `answer(requestId, body)` and `stop()`.

## The read of a conversation

`useMarkRead(id, lastSeq)` (`src/hooks/use-mark-read.ts`) sends
`POST /api/conversations/:id/read` with the `seq` of the last entry. It sends
it when the page opens or a new entry comes, and when the window gets the
focus. It sends nothing while `document.hasFocus()` is false, so a
conversation in a background window stays unread.

## The DM page

`src/components/conversation/` holds the parts of the timeline:

| Part                 | Shows                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `timeline.tsx`       | One block for each run of entries by the same author                                   |
| `tool-call-card.tsx` | The tool, its main input, and its result: `4 lines`, `+1 −1`, the output, or the error |
| `approval.tsx`       | Deny, Allow once and Always allow, under the tool call that waits                      |
| `question-card.tsx`  | Each question with its options as buttons, then the answer                             |
| `composer.tsx`       | The message box. Enter sends, Shift+Enter adds a line                                  |
| `agent-look.ts`      | The avatar colours, the initials, and the status of each state                         |

The main input of a tool is `file_path`, `command`, `pattern` or `url`. A path
in the folder of the agent shows without that folder.

An approval card shows inside the card of its tool call, so a waiting call is
one card, as in the design. Always allow tells what each suggestion grants. A
rule for `localSettings` stays in the folder of the agent, so the text says
so.

The card of an `Agent` call names the task of the subagent (its
`description`). The tool calls of the subagent are inside that card, behind
a ghost button such as "3 tool calls" in the header of the card. Each call of
the subagent is a compact card. The list opens by itself while one of those
calls waits for an approval, so the approval card is always visible, and the
dot of the `Agent` card then shows the waiting colour.

A tool call that a stop interrupted shows a grey dot and "Stopped"
(`docs/timeline.md`). A new session shows as a dashed divider in the link
colour, with a restart icon: "New session · 09:12".

A failed process shows one line: "test-runner stopped with an error (exit code
1)." "Show details" opens the stderr of the process.

A rate-limit notice is one line with a warning icon: "The five-hour rate
limit is reached. It resets at 14:00." A limit that is near, but not reached,
says "near". A reset on a later day names the day: "It resets on Tuesday 17
November at 09:00."

Each block shows the time of its first entry next to the author, as 24-hour
`HH:MM` ("14:03") in the local time zone. A level 2 heading names the day
before the first block of each day: "Today", "Yesterday", or "Friday 13
November". A block ends at a change of day, so that the heading sits between
two blocks. `src/lib/time.ts` holds the formats.

A message that is still arriving has `aria-busy="true"`. Text between two
backticks on one line shows as `code`, in mono on the `muted` ground. The
timeline renders no other markdown. A turn summary shows
`Done in 9.2 s · $0.012 · 7 turns`, or `Stopped after 24.4 s`.

The status of an agent:

| State      | Label          |
| ---------- | -------------- |
| `starting` | Starting       |
| `idle`     | Idle           |
| `busy`     | Working        |
| `waiting`  | Needs approval |
| `failed`   | Error          |
| `exited`   | Stopped        |

The labels are the words of the design.

While an agent is `busy` or `waiting`, the header shows Stop, and a line over
the message box gives its state:

| State                       | Line                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `busy`                      | "test-runner is working. Your next message waits until this turn ends."            |
| `waiting`, for a permission | "test-runner needs your approval. Your next message waits until this turn ends."   |
| `waiting`, for a question   | "test-runner waits for your answer. Your next message waits until this turn ends." |
| `failed`                    | "test-runner stopped. Your next message starts it again and resumes the session."  |

## A DM

The header shows the avatar of the agent with a status dot, its status Badge,
Stop while it works, the tabs Messages, Files and Session log, and Configure,
which opens `/agents/:id`. The messages start with a line about the agent:
"This is your DM with test-runner. In a DM, the agent replies to every
message. It runs Claude Code in /home/user/code/web-app."

## A refused action

Each action of `useConversation()` resolves to the reason of a refusal, or to
`null`. It never rejects. `refusalOf()` in `src/lib/refusal.ts` gives the
`error` of the server, or "The server did not answer." when no answer came.

When the server refuses Stop, a message or an answer to a card, an alert over
the message box shows the reason. The alert closes at the next action that
works, or with its button "Close the alert". The router keeps the page when the user
opens another conversation, so the page keeps the ID of the conversation with
the reason, and shows the alert only there. The session panel has its own
alert (`docs/web-app/session-panel.md`).

## A group chat or a channel

The header shows the name, the topic, "Stop all" while an agent works, and
the members button (`docs/web-app/session-panel.md`). Each message shows its
author. The message box of a channel is "Message #<name>".

While an agent works or waits, one line at the end of the thread gives the
state of each agent: "test-runner is working. reviewer-bot is idle." Over
the message box, a note says that agents reply to each other in this thread
when they @mention each other, and that Stop all ends the chain.

After `@`, the message box shows the agents of the conversation whose names
start with the typed text. Down and Up move the active name, and wrap at
the ends. Tab or Enter picks the active name, and a click picks any one.
Escape closes the list until the text changes. The pick puts `@<name> ` in
the place of the typed text. The message box names the active option with
`aria-activedescendant`.
