import type { ReactNode } from "react"

export function FormBar({
  status,
  children,
}: {
  status: ReactNode
  children: ReactNode
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 sm:px-8">
      <div
        role="status"
        className="flex min-w-56 flex-1 flex-col gap-0.5 text-muted-foreground"
      >
        {status}
      </div>
      {children}
    </div>
  )
}
