# The text of a message

The timeline shows the text of each message as Markdown. Your messages and
the messages of an agent use the same rules. `timeline/message-text.tsx`
holds the rules, with `react-markdown`, `remark-gfm` and `remark-breaks`.

## What shows

| Markdown                  | Look                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `**bold**`                | `font-semibold` in `foreground-strong`                                                |
| `# Heading`, `## Heading` | An `h3` of 16 px. `###` gives an `h4`. A heading is smaller than the day headings     |
| `- item`, `1. item`       | A list with the markers in `muted-foreground`                                         |
| `` `code` ``              | Mono on the `muted` ground, in `agent-yellow`                                         |
| A fenced block            | A `CodeBlock` with the language name, a "Copy" button and syntax colours. See below   |
| `[text](url)`             | A `link` with an underline. It opens in a new tab, with `rel="noreferrer"`            |
| A table                   | Rules under the rows, left alignment. A wide table scrolls in its own box             |
| `> quote`                 | A rule at the left, in `muted-foreground`                                             |
| `---`                     | A horizontal rule                                                                     |
| One line break            | A line break. Standard Markdown joins the two lines, but a chat keeps them, as before |

The text of a message stays the source. So the copy button of the message
copies the Markdown, not the rendered text.

## What does not show

HTML in a message shows as text. The app does not use `rehype-raw`,
because an agent can write any text. The URL filter of `react-markdown`
removes a `javascript:` URL from a link. A test of the conversation page
keeps both rules.

## Code blocks

`timeline/fenced-code.tsx` shows a fenced block. The header gives the
language of the fence, or "text" when the fence gives none.
`src/lib/highlight.ts` gives the syntax colours with Shiki:

- Shiki loads at the first code block, with a dynamic `import()`. So the
  first page does not get larger.
- It uses `shiki/core` with the JavaScript regex engine, so no WASM file
  loads.
- It knows `ts`, `tsx`, `js`, `json`, `sh` (and `bash`, `shell`, `zsh`),
  `css`, `html`, `md`, `py`, `go`, `sql`, `diff` and `yaml`. Each grammar
  loads at its first use. A block of another language stays plain mono
  text.
- The theme is `gruvbox-dark-medium`, because the app has the Gruvbox dark
  palette only. The `light` class of the theme provider does not change it.
- A block in a message that still arrives stays plain. It gets its colours
  when the message is done, so that Shiki does not run at each delta.

## A message that is still arriving

The text has `aria-busy="true"`. The last block ends with a blinking caret
(`▍`, a CSS `::after`, so the text of the message stays the same). A code
fence that is not closed yet shows as a code block until its end arrives.

## Mentions

Outside the code, the text marks two kinds of mention. Neither changes the
text of the message:

| Mention          | Rule                                                                                        | Look                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@test-runner`   | `mentionPattern()` of `server/conversation/mentions.ts`, for each agent of the conversation | The colour of that agent (`MENTION_COLOURS` in `agent-look.ts`), on a 10 % tint of it    |
| `@src/notes.txt` | `@` and a path with a `/` or an extension, not after a letter (`dev@example.com`)           | A file icon, then the path in mono `link` on a 10 % tint of `link`. The `@` is `sr-only` |

A mention shows in a paragraph, a list item, a heading, bold text and a table
cell. A mention in inline code or in a code block stays plain text. A mention
of an agent that is not in the conversation also stays plain text, the same
as on the server (`docs/conversations.md`).

The parts of `react-markdown` come from `useMemo`. A new object at each render
gives new component types, and then React mounts each element again at each
render.
