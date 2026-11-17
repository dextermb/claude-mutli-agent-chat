import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"

export function SettingsSection({
  id,
  title,
  description,
  changed = false,
  children,
}: {
  id: string
  title: string
  description: string
  changed?: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-5 flex-wrap gap-x-8 gap-y-4 border-t pt-6"
    >
      <div className="flex min-w-48 flex-[1_1_200px] flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2
            id={`${id}-title`}
            className="m-0 text-sm font-semibold text-foreground-strong"
          >
            {title}
          </h2>
          {changed && <Badge variant="secondary">Changed</Badge>}
        </div>
        <p className="m-0 leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 flex-[999_1_400px]">{children}</div>
    </section>
  )
}
