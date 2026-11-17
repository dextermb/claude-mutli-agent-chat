# The timeline

This page gives the parts of the thread: the blocks, the tool calls, the
cards, the dividers, the notices, the times and the status words.

## The parts

`src/components/conversation/` holds the parts of the timeline. They use the
shadcn AI Elements: Bubble, Trace, CodeBlock, HoverCard and Progress. See
`docs/web-app/components.md` for the layout of the directories.

| Part                           | Shows                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `timeline/timeline.tsx`        | One block for each run of entries by the same author                            |
| `tool-call/tool-call-line.tsx` | One Trace line for each tool call, with its output, diff or subagent behind it  |
| `cards/approval.tsx`           | Deny, Allow once and Always allow, in an outline Item under the call that waits |
| `cards/question-card.tsx`      | Each question with its options as buttons, then the answer                      |
| `composer/composer.tsx`        | The message box. Enter sends, Shift+Enter adds a line                           |
| `composer/model-link.tsx`      | The model of a DM, in the message box                                           |
| `composer/context-figure.tsx`  | The context of a DM, in the message box                                         |
| `working-line.tsx`             | One line at the end of the thread for each agent that works                     |
| `agent-look.ts`                | The avatar colours, the initials, and the status of each state                  |

## A block

Your messages are a muted Bubble at the right, with no avatar. The time of the
first one shows under them. The block is an `article` named "You, 14:03".

An agent block has a header row: a small avatar, the name, the "Agent" Badge
and the time. The content is under it, at full width. The block is named
"test-runner, 14:03". Each message of the agent that is done has a ghost
button "Copy the message".

`timeline/agent-reply.tsx` puts the button in one of two places:

- A message of one rendered line has the button at the right edge of the
  message column, in the same row. So the buttons of one-line messages are
  in one column.
- A message of more lines has the button under the text, at the left.

The count is of rendered lines, not of line breaks in the text. A long
paragraph that wraps has more than one line. The text has a height of 22 px
for each line, so a height of 26 px or less is one line. A `ResizeObserver`
measures the height again when the width changes. The text always keeps the
width of the first column. Thus the move of the button cannot change the
count of lines.

## A tool call

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

After the first click, the buttons of an approval card are disabled until
the answer comes back from Claude Code, so a card sends one answer
(`docs/server.md`). A question card does the same after the choice that
answers each question. If the server refuses the answer, the page shows the
refusal, and the buttons work again.

## The dividers

A new session shows as a dashed divider in the link colour, with a restart
icon: "New session · 09:12".

A compaction shows as a dashed divider in the faint colour, with a fold
icon: "test-runner compacted its memory: 39,857 → 11,894 tokens · $0.002 ·
14:30". The cost comes from the turn of a `/compact`, which has no line of
its own. An automatic compaction comes inside a turn, so its divider has no
cost, and that turn keeps its line. While it runs, it says "test-runner compacts its memory… · 14:30".
Like a new session, it is not inside the block of the agent. A compaction
that failed shows nothing, because Claude Code tries again later by itself.

## The notices

A failed process shows one line: "test-runner stopped with an error (exit code
1)." "Show details" opens the stderr of the process, in the error CodeBlock.

A rate-limit notice is one line with a warning icon: "The five-hour rate
limit is reached. It resets at 14:00." A limit that is near, but not reached,
says "near". A reset on a later day names the day: "It resets on Tuesday 17
November at 09:00."

## The times

Each block shows the time of its first entry next to the author, as 24-hour
`HH:MM` ("14:03") in the local time zone. A level 2 heading names the day
before the first block of each day: "Today", "Yesterday", or "Friday 13
November". A block ends at a change of day, so that the heading sits between
two blocks. `src/lib/time.ts` holds the formats.

## The text and the turn summary

The text of a message is Markdown, with the mentions marked. See
`docs/web-app/messages.md` for the rules, the code blocks, the caret of a
message that still arrives, and the mentions.

A turn summary shows
`Done in 9.2 s · $0.012 · 7 turns`, or `Stopped after 24.4 s`, or, at the
turn limit of the agent, `Stopped at the turn limit after 9.2 s · $0.012 · 7
turns. Send a message to continue.`

## The status words

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
