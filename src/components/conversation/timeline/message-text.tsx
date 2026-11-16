import { Children, isValidElement, useMemo, type ReactNode } from "react"
import Markdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { FencedCode } from "@/components/conversation/timeline/fenced-code"
import { withMentions } from "@/components/conversation/timeline/with-mentions"
import type { ConversationAgent } from "@/lib/agent-api"

const PLUGINS = [remarkGfm, remarkBreaks]

export function MessageText({
  text,
  agents,
  done,
}: {
  text: string
  agents: ConversationAgent[]
  done: boolean
}) {
  const components = useMemo(() => markdownParts(agents, done), [agents, done])
  return (
    <Markdown remarkPlugins={PLUGINS} components={components}>
      {text}
    </Markdown>
  )
}

function markdownParts(agents: ConversationAgent[], done: boolean): Components {
  const mentions = (children: ReactNode) =>
    Children.map(children, (child) =>
      typeof child === "string" ? withMentions(child, agents) : child
    )
  return {
    p: ({ children }) => <p className="m-0">{mentions(children)}</p>,
    li: ({ children }) => <li>{mentions(children)}</li>,
    h1: ({ children }) => (
      <h3 className="m-0 text-base font-semibold text-foreground-strong">
        {mentions(children)}
      </h3>
    ),
    h2: ({ children }) => (
      <h3 className="m-0 text-base font-semibold text-foreground-strong">
        {mentions(children)}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="m-0 font-semibold text-foreground-strong">
        {mentions(children)}
      </h4>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground-strong">
        {mentions(children)}
      </strong>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-link underline decoration-link/40 underline-offset-2 hover:decoration-link"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="m-0 list-disc pl-5 marker:text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="m-0 list-decimal pl-5 marker:text-muted-foreground">
        {children}
      </ol>
    ),
    pre: ({ children }) => {
      const code = isValidElement<{ className?: string; children?: ReactNode }>(
        children
      )
        ? children.props
        : {}
      return (
        <FencedCode
          code={String(code.children ?? "").replace(/\n$/, "")}
          language={/language-(\S+)/.exec(code.className ?? "")?.[1] ?? null}
          done={done}
        />
      )
    },
    table: ({ children }) => (
      <div className="max-w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-border py-1 pr-4 align-bottom font-semibold text-foreground-strong">
        {mentions(children)}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-border/60 py-1 pr-4 align-top">
        {mentions(children)}
      </td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="m-0 flex flex-col gap-2 border-l-2 border-border pl-3 text-muted-foreground">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-1 border-border" />,
    code: ({ children }) => (
      <code className="rounded-sm bg-muted px-[5px] py-px font-mono text-[13px] text-agent-yellow">
        {children}
      </code>
    ),
  }
}
