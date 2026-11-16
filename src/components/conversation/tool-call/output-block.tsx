import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import { cn } from "@/lib/utils"

export function OutputBlock({
  text,
  failed,
}: {
  text: string
  failed: boolean
}) {
  return (
    <CodeBlock
      size="sm"
      className={cn(
        failed && "border-transparent bg-error-soft text-foreground"
      )}
    >
      <CodeBlockContent wrap className="max-h-64">
        {text}
      </CodeBlockContent>
    </CodeBlock>
  )
}
