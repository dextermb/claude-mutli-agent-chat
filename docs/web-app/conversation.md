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

`src/components/conversation/` holds the parts of the timeline. They use the
shadcn AI Elements: Bubble, Trace, CodeBlock, HoverCard and Progress.

| Part                 | Shows                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| `timeline.tsx`       | One block for each run of entries by the same author                            |
| `tool-call-line.tsx` | One Trace line for each tool call, with its output, diff or subagent behind it  |
| `approval.tsx`       | Deny, Allow once and Always allow, in an outline Item under the call that waits |
| `question-card.tsx`  | Each question with its options as buttons, then the answer                      |
| `composer.tsx`       | The message box. Enter sends, Shift+Enter adds a line                           |
| `composer-tools.tsx` | The model and the context of a DM, in the message box                           |
| `working-line.tsx`   | One line at the end of the thread for each agent that works                     |
| `agent-look.ts`      | The avatar colours, the initials, and the status of each state                  |

### A block

Your messages are a muted Bubble at the right, with no avatar. The time of the
first one shows under them. The block is an `article` named "You, 14:03".

An agent block has a header row: a small avatar, the name, the "Agent" Badge
and the time. The content is under it, at full width. The block is named
"test-runner, 14:03". Each message of the agent that is done has a ghost
button "Copy the message".

### A tool call

Calls that follow each other in a block share one `Trace`. Each call is a
`section` named for its tool and its main input ("Bash echo hello"), with one
`TraceLine`: an icon, a verb with the main input, and a description.

| Tool     | Runs                       | Done                   | Failed                    |
| -------- | -------------------------- | ---------------------- | ------------------------- |
| Read     | Reading `path`             | Read `path`            | Failed to read `path`     |
| Edit     | Editing `path`             | Edited `path`          | Failed to edit `path`     |
| Write    | Writing `path`             | Wrote `path`           | Failed to write `path`    |
| Bash     | Running `cmd`              | Ran `cmd`              | Failed to run `cmd`       |
| WebFetch | Fetching `url`             | Fetched `url`          | Failed to fetch `url`     |
| Agent    | Running the subagent: task | Ran the subagent: task | The subagent failed: task |

Another tool shows its name and its main input. The description gives
`4 lines`, `+1 −1`, `Stopped`, or the count of the calls of a subagent, in
`foreground-faint`. A call that runs shows a spinner and its title shimmers.
A call that waits shows its icon in the waiting colour.

The main input of a tool is `file_path`, `command`, `pattern` or `url`. A path
in the folder of the session shows without that folder. The page reads that
folder from `sessionCwd` of each agent, so a generic agent in a channel uses
the folder of the channel (`docs/agents.md`).

A line with more to show is the trigger of a `TraceCollapsible`:

- The output of a command, or the text of an error, in a `CodeBlock` of size
  `sm`. The block wraps and scrolls after 16 rem.
- The lines of a diff (`docs/timeline.md`), each marked added or removed.
  When the server keeps only the first 200 lines, the foot says "12 more
  lines".
- The calls of a subagent, as a second Trace. It opens by itself while one
  of those calls waits for an approval, so the approval is always visible.

A failed call opens by itself. Its line is `foreground` with a red icon, and
its output is `foreground` on `error-soft`, because the `destructive` text of
the components is 4.3:1 on `background`.

The approval shows under its call, so a waiting call is one part, as in the
design. Always allow tells what each suggestion grants. A rule for
`localSettings` stays in the folder of the session, so the text says so. In a
channel with a folder, each agent of that channel gets the rule. After the
answer, the Item goes, and one line says "Allowed", "Denied" or "Expired".

A new session shows as a dashed divider in the link colour, with a restart
icon: "New session · 09:12".

A failed process shows one line: "test-runner stopped with an error (exit code
1)." "Show details" opens the stderr of the process, in the error CodeBlock.

A rate-limit notice is one line with a warning icon: "The five-hour rate
limit is reached. It resets at 14:00." A limit that is near, but not reached,
says "near". A reset on a later day names the day: "It resets on Tuesday 17
November at 09:00."

Each block shows the time of its first entry next to the author, as 24-hour
`HH:MM` ("14:03") in the local time zone. A level 2 heading names the day
before the first block of each day: "Today", "Yesterday", or "Friday 13
November". A block ends at a change of day, so that the heading sits between
two blocks. `src/lib/time.ts` holds the formats.

A message that is still arriving has `aria-busy="true"`, and ends with a
blinking caret (`▍`, a CSS `::after`, so the text of the message stays the
same). Text between two
backticks on one line shows as `code`, in mono on the `muted` ground. The
timeline renders no other markdown.

Outside the code, the timeline marks two kinds of mention. Neither changes the
text of the message:

| Mention          | Rule                                                                                        | Look                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@test-runner`   | `mentionPattern()` of `server/conversation/mentions.ts`, for each agent of the conversation | The colour of that agent (`MENTION_COLOURS` in `agent-look.ts`), on a 10 % tint of it    |
| `@src/notes.txt` | `@` and a path with a `/` or an extension, not after a letter (`dev@example.com`)           | A file icon, then the path in mono `link` on a 10 % tint of `link`. The `@` is `sr-only` |

So a mention of an agent that is not in the conversation stays plain text, the
same as on the server (`docs/conversations.md`).

A turn summary shows
`Done in 9.2 s · $0.012 · 7 turns`, or `Stopped after 24.4 s`, or, at the
turn limit of the agent, `Stopped at the turn limit after 9.2 s · $0.012 · 7
turns. Send a message to continue.`

The status of an agent:

| State      | Label          |
| ---------- | -------------- |
| `starting` | Starting       |
| `idle`     | Idle           |
| `busy`     | Working        |
| `waiting`  | Needs approval |
| `failed`   | Error          |
| `exited`   | Stopped        |

The labels are the words of the design. The `busy` dot pulses, everywhere
it shows. Under `prefers-reduced-motion`, the pulse, the spinner shimmer and
the caret blink stop.

## The working line

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

## A DM

The header shows the avatar of the agent with a status dot, its status Badge,
Stop while it works, the tabs Messages, Files and Session log, and Configure,
which opens `/agents/:id`. The messages start with a line about the agent:
"This is your DM with test-runner. In a DM, the agent replies to every
message. It runs Claude Code in /home/user/code/web-app."

The message box of a DM shows the model of the agent, as a link to
`/agents/:id` named "Model: claude-sonnet-5-5". A change of model is a change
of the agent, so the message box does not change it. After the first turn, it
also shows "31% context". A HoverCard on it shows a Progress named "Context"
and the count: "62,400 / 200,000 tokens". The value comes from the session
card (`docs/web-app/session-panel.md`). The attach and Send buttons are round.

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

The header shows the name, "Stop all" while an agent works, and the members
button (`docs/web-app/session-panel.md`). Each message shows its author. The
message box of a channel is "Message #<name>".

The header of a channel also shows its topic, then when the agents reply:
"Agents reply when you @mention them." or "Agents reply to every message."
At the end, a ghost icon button "Channel settings" opens
`src/components/channel-settings-dialog.tsx`, with the title "Channel
settings" and "#<name>". It has the Topic, Private and reply-mode fields of
Create a channel (`src/components/channel-fields.tsx`). Save sends only the
fields that changed to `PATCH /api/conversations/:id`, and closes the dialog.
With no change, Save closes it with no request. The header, the icon and the
sidebar follow the `conversation` event of the stream. A refusal shows "The
server did not save the settings." and the reason, and the dialog stays open.
A group chat and a DM have no settings.

Each agent that works has a working line at the end of the thread (see
above). An idle or stopped member has no line: the members panel shows its
state. Over the message box, a note says that agents reply to each other in this thread
when they @mention each other, and that Stop all ends the chain.

After `@`, the message box shows the agents of the conversation whose names
start with the typed text, in a list named "Members". Each option shows the
avatar of the agent, its name and its status Badge, and a screen reader hears
"test-runner Idle". The hint under the box shows a `Kbd`: "Enter to send", or
"Tab to pick" while the list is open. Down and Up move the active name, and wrap at
the ends. Tab or Enter picks the active name, and a click picks any one.
Escape closes the list until the text changes. The pick puts `@<name> ` in
the place of the typed text. The message box names the active option with
`aria-activedescendant`.
