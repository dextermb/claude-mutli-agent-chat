import { Separator } from "@/components/ui/separator"
import { dayName } from "@/lib/time"

export function DayHeading({ createdAt }: { createdAt: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <Separator className="flex-1" />
      <h2 className="m-0 text-xs font-medium text-foreground-faint">
        {dayName(createdAt)}
      </h2>
      <Separator className="flex-1" />
    </div>
  )
}
