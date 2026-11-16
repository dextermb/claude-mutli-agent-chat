import { Trash2Icon } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DeleteSection({
  action,
  text,
  onDelete,
  className,
}: {
  action: string
  text: string
  onDelete: () => void
  className?: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-3",
        className
      )}
    >
      <div className="flex min-w-50 flex-1 flex-col gap-0.5">
        <p
          id={titleId}
          className="text-sm leading-5 font-semibold text-foreground-strong"
        >
          {action}
        </p>
        <p className="text-[13px] leading-5 text-muted-foreground">{text}</p>
      </div>
      <Button type="button" variant="destructive" onClick={onDelete}>
        <Trash2Icon />
        {action}
      </Button>
    </section>
  )
}
