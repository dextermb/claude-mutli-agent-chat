import { Badge } from "@/components/ui/badge"

export function AllowedTools({ tools }: { tools: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <Badge key={tool} variant="secondary" className="font-mono">
          {tool}
        </Badge>
      ))}
    </div>
  )
}
