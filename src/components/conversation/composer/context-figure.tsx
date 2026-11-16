import { buttonVariants } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import type { SessionCard } from "@/lib/agent-api"
import { contextPercent, contextTokens } from "@/lib/context"
import { cn } from "@/lib/utils"

type Context = NonNullable<SessionCard["context"]>

export function ContextFigure({ context }: { context: Context }) {
  const percent = contextPercent(context)
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "xs" }),
              "text-muted-foreground tabular-nums"
            )}
          />
        }
      >
        {percent}% context
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start">
        <Progress value={percent}>
          <ProgressLabel>Context</ProgressLabel>
          <ProgressValue />
        </Progress>
        <p className="m-0 mt-2 font-mono text-xs text-muted-foreground">
          {contextTokens(context)} tokens
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
