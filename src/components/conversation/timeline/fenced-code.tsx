import { useEffect, useState } from "react"
import type { ThemedToken } from "shiki/core"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { highlight } from "@/lib/highlight"

export function FencedCode({
  code,
  language,
  done,
}: {
  code: string
  language: string | null
  done: boolean
}) {
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null)

  useEffect(() => {
    if (!done || !language) return
    let current = true
    void highlight(code, language).then((lines) => {
      if (current) setTokens(lines)
    })
    return () => {
      current = false
    }
  }, [code, language, done])

  return (
    <CodeBlock size="sm">
      <CodeBlockHeader>
        <CodeBlockTitle className="font-mono">
          {language ?? "text"}
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {tokens
          ? tokens.map((line, index) => (
              <CodeBlockLine key={index}>
                {line.map((token, at) => (
                  <span key={at} style={{ color: token.color }}>
                    {token.content}
                  </span>
                ))}
              </CodeBlockLine>
            ))
          : code}
      </CodeBlockContent>
    </CodeBlock>
  )
}
