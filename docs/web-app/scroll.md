# The scroll of the messages

This page tells how the messages of a conversation stay at the bottom while
new content arrives. The timeline itself is in `docs/web-app/conversation/timeline.md`.

## The parts

`useStickToBottom(key)` (`src/hooks/use-stick-to-bottom.ts`) holds the
rules. The conversation page gives it the conversation id as the key. The
hook returns four values:

- `scrollRef`: the ref of the scroll box. This box is the region "Messages"
  of the Messages panel.
- `contentRef`: the ref of the box in the scroll box that holds the DM line,
  the timeline and the working lines.
- `atBottom`: true while the view sticks to the bottom.
- `jumpToBottom()`: goes to the bottom and starts the stick again.

The hook uses no package. The `use-stick-to-bottom` package adds a spring
animation that this app does not need, and its logic is outside the tests.

## The stick

- **At the bottom** means 24 px or less from the bottom of the scroll box.
- A conversation opens at the bottom. A change of the conversation id starts
  the stick again, also when the user scrolled up in the last conversation.
- A `ResizeObserver` watches the content and the scroll box. Each new
  message, each streaming delta and each opened card changes the height.
  While the view sticks, the hook then sets `scrollTop` to the bottom, with
  no animation.
- A scroll event that comes to 24 px or less from the bottom starts the
  stick.
- A scroll event that moves up, and stops more than 24 px from the bottom,
  stops the stick. A scroll down that stops above the bottom does not change
  the state. Thus the steps of a smooth scroll to the bottom do not stop
  the stick.

## The jump button

`JumpButton` (`src/components/conversation/timeline/jump-button.tsx`) shows
while the view does not stick. It is a round outline button with an
`ArrowDownIcon`, at the bottom centre of the messages, over them. Its
accessible name is "Jump to the latest message". It shows no count.

A click calls `jumpToBottom()`. The scroll is smooth. With
`prefers-reduced-motion: reduce`, the scroll is instant. The button goes
away at once, and new content keeps the view at the bottom again.

## A sent message

A message that the user sends also calls `jumpToBottom()`. The message then
arrives through the event stream, and the stick keeps it in view.

## A focused entry

The Files tab of a DM can focus an entry in the timeline. The Messages panel
mounts again, and the hook first goes to the bottom. Then the page focuses
the entry, and the browser scrolls up to it. That scroll stops the stick, and
the jump button shows. No special code is necessary.

## The tests

The tests are in `src/pages/conversations/[id].test.tsx`, in the group "the
scroll of the messages". jsdom has no layout, so the tests use
`scrollLayout()`, `userScroll()` and `fakeResizeObserver()` from
`src/test/fake-layout.ts`. See `docs/testing.md`.
