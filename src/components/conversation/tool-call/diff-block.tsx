import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockFooter,
  CodeBlockLine,
} from "@/components/ui/code-block"
import type { DiffLine } from "@/lib/agent-api"

const LINE_VARIANT = {
  add: "added",
  remove: "removed",
  same: "default",
} as const

export function DiffBlock({
  lines,
  more,
}: {
  lines: DiffLine[]
  more: number
}) {
  return (
    <CodeBlock size="sm">
      <CodeBlockContent className="max-h-64">
        {lines.map((line, index) => (
          <CodeBlockLine key={index} variant={LINE_VARIANT[line.kind]}>
            {line.text}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
      {more > 0 && (
        <CodeBlockFooter className="text-xs text-foreground-faint">
          {more} more lines
        </CodeBlockFooter>
      )}
    </CodeBlock>
  )
}
