# The web app

The web app shows the agents, a DM with each agent, and the configuration of
each agent. It reads and writes through the agent server (`docs/server.md`).

## Run it

Start the agent server and the Vite dev server in two terminals:

```sh
pnpm server   # the agent server on 127.0.0.1:4100
pnpm dev      # the web app; Vite sends /api to port 4100
```

## Pages

| URL                  | File                               | Shows                                             |
| -------------------- | ---------------------------------- | ------------------------------------------------- |
| `/`                  | `src/pages/index.tsx`              | The agents, with Message, Configure and New agent |
| `/agents/new`        | `src/pages/agents/[id].tsx`        | The form for a new agent                          |
| `/agents/:id`        | `src/pages/agents/[id].tsx`        | The form for a saved agent                        |
| `/conversations/:id` | `src/pages/conversations/[id].tsx` | The DM with an agent                              |

Message on the home page opens the DM with that agent. The server gives back
the same DM each time, so an agent has one DM.

## Types

`src/lib/agent-api.ts` holds the types that the browser and the server share.
It imports them with `import type` from `server/api-types.ts` and
`server/timeline/reduce.ts`. Those two files import no Node module, so the
type check of the app does not need the Node types.

## `useConversation(id)`

`src/hooks/use-conversation.ts` holds one conversation:

1. It loads `GET /api/conversations/:id` (the conversation, its agents and
   the state of each agent) and `GET /api/conversations/:id/timeline`.
2. It opens an `EventSource` on `/api/conversations/:id/events?lastEventId=<n>`,
   with the `lastEventId` of the timeline. So no event goes missing between
   the two requests. After a lost connection, the browser sends
   `Last-Event-ID` itself.
3. An `item` event replaces the entry with the same ID, or adds it at the end.
   An `agent_state` event changes the state of that agent.
4. It closes the stream when the page goes away.

It gives `status`, `conversation`, `agents`, `entries`, and three actions:
`send(text)`, `answer(requestId, body)` and `stop()`.

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

Each block shows the time of its first entry next to the author, as 24-hour
`HH:MM` ("14:03") in the local time zone. A level 2 heading names the day
before the first block of each day: "Today", "Yesterday", or "Friday 13
November". A block ends at a change of day, so that the heading sits between
two blocks. `src/lib/time.ts` holds the formats.

A message that is still arriving has `aria-busy="true"`. A turn summary shows
`Done in 9.2 s · $0.012 · 7 turns`, or `Stopped after 24.4 s`.

The status of an agent:

| State      | Label    |
| ---------- | -------- |
| `starting` | Starting |
| `idle`     | Online   |
| `busy`     | Working  |
| `waiting`  | Waiting  |
| `failed`   | Error    |
| `exited`   | Idle     |

While an agent is `busy` or `waiting`, the header shows Stop, and a line over
the message box says that the next message waits.

## The sidebar

`src/components/app-sidebar.tsx` shows on the home page and on the
conversation page. It lists:

- the channels, with `#` or a lock,
- the group chats,
- each agent, with a status dot and its status as text for a screen reader.
  An agent with a DM links to it. An agent with no DM is a button that opens
  one.

The current conversation has `aria-current="page"`. The sidebar loads the
lists again each time the page moves to another conversation.

## Start a chat and Create a channel

Two dialogs that the sidebar opens:

- **Start a chat** (`src/components/start-chat-dialog.tsx`), from the pen
  button. The search filters the agents by name. Each picked agent shows in
  "To:". One agent opens its DM, and two or more agents start a group chat.
  The footer says which one. If the server refuses the chat, the dialog
  shows the reason and stays open.
- **Create a channel** (`src/components/create-channel-dialog.tsx`), from the
  `+` of Channels. It sends the name, the topic, Private, the invited agents
  and the reply mode. If the server refuses the channel, the dialog shows the
  reason and stays open.

After each one, the page moves to the new conversation.

## A group chat or a channel

The header shows the name, the topic, and each agent with its status. Each
message shows its author. The message box of a channel is "Message #<name>".

After `@`, the message box shows the agents of the conversation whose names
start with the typed text. Down and Up move the active name, and wrap at
the ends. Tab or Enter picks the active name, and a click picks any one.
Escape closes the list until the text changes. The pick puts `@<name> ` in
the place of the typed text. The message box names the active option with
`aria-activedescendant`.

## The agent page

The form sends every field. A new agent goes to `POST /api/agents`, then the
page moves to `/agents/<id>`. A saved agent goes to `PATCH /api/agents/:id`.
If the server refuses the agent, the page shows the reason in an alert.

The model and the permission mode use a native `<select>`
(`native-select`), because it is accessible and easy to test.

A change to an agent does not change a process that runs. The next process
uses the new configuration.

## Not built yet

- The session card of the design: model, folder, session ID, turns and cost.
- New session, and the Files and Session log tabs.
