# The data of a conversation

This page gives the hook that holds a conversation, the read of a
conversation, and what the page shows when the server refuses an action.

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
