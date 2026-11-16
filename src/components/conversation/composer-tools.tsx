import { CpuIcon } from "lucide-react"
import { Link } from "wouter"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ModelLink({
  agentId,
  model,
}: {
  agentId: string
  model: string
}) {
  return (
    <Link
      href={`/agents/${agentId}`}
      aria-label={`Model: ${model}`}
      className={cn(
        buttonVariants({ variant: "ghost", size: "xs" }),
        "font-mono text-muted-foreground"
      )}
    >
      <CpuIcon />
      {model}
    </Link>
  )
}
