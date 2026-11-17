# Motion

The motion of the web app is short and quiet. Most changes are a fade or a
colour change of 100 to 200 ms. This page gives the rules that each new
component must follow.

## Reduced motion

When the operating system asks for reduced motion, nothing moves, scales,
rotates or blurs. A fade stays, so the user still sees the change.

The app does this in four ways:

| Motion                                              | How it stops                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animate-in` and `animate-out` of `tw-animate-css`  | The `prefers-reduced-motion: reduce` block at the end of `src/index.css` sets the scale, move, rotate and blur variables to their neutral values. The fade stays. |
| A transition of `transform`, `translate` or `scale` | The class takes `motion-safe:`, or the element adds `motion-reduce:transition-none`.                                                                              |
| A sheet and a toast                                 | Their move classes take `motion-safe:`. Under reduced motion, a toast fades in and out.                                                                           |
| A loop (the status dot, the caret, the shimmer)     | `motion-reduce:animate-none` or `motion-reduce:shimmer-none`.                                                                                                     |

`tw-animate-css` has no rule for reduced motion of its own. So a new
`zoom-*`, `slide-*` or `spin-*` class is safe, but a new transition of a
transform needs its own `motion-safe:` or `motion-reduce:` class.

The spinner (`animate-spin`) does not stop. It is the only sign that work
continues, and it does not move across the page.

## Disclosures

`CollapsibleContent` in `src/components/ui/collapsible.tsx` opens and closes
with a change of height and a fade over 200 ms. Under reduced motion, only
the fade stays. The trace of a tool call, the summary of a compaction and
the session of a member all use it.

The panel clips its content while it moves. Put the padding, the background
and any scroll on an inner element, not on `CollapsibleContent`, or the
padding shows while the height is 0.

The command preview on the agent page uses a native `<details>`, so it opens
at once.

## Transitions

- Name the properties that change, for example
  `transition-[color,background-color,border-color,box-shadow]`. Do not use
  `transition-all`. It also animates a change of size or position that
  nobody meant to animate.
- A pressed `Button` gets smaller, to `scale: 0.96`, with `ease-out`. It
  does not change when reduced motion is on.
- The sidebar moves on `cubic-bezier(0.2, 0, 0, 1)`, not on a linear curve.
- The floating sidebar of the peek (`docs/web-app/sidebar.md`) comes in with
  `animate-in fade-in slide-in-from-left-2` over 150 ms. Under reduced
  motion, the `prefers-reduced-motion` block of `src/index.css` takes the
  move away, and the fade stays.
- A change of theme turns off all transitions for one frame, through
  `disableTransitionsTemporarily()` in `src/lib/theme.ts`.

## The shadcn files

Some of these rules live in `src/components/ui`. `shadcn add --overwrite`
replaces such a file and removes the rule. After you add a component again,
do the steps in this page again for that component.
