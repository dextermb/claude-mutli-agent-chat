import { FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const SWATCHES: Record<string, string> = {
  orange:
    "bg-agent-orange dark:bg-agent-orange data-checked:bg-agent-orange dark:data-checked:bg-agent-orange",
  yellow:
    "bg-agent-yellow dark:bg-agent-yellow data-checked:bg-agent-yellow dark:data-checked:bg-agent-yellow",
  green:
    "bg-agent-green dark:bg-agent-green data-checked:bg-agent-green dark:data-checked:bg-agent-green",
  aqua: "bg-agent-aqua dark:bg-agent-aqua data-checked:bg-agent-aqua dark:data-checked:bg-agent-aqua",
  blue: "bg-agent-blue dark:bg-agent-blue data-checked:bg-agent-blue dark:data-checked:bg-agent-blue",
  purple:
    "bg-agent-purple dark:bg-agent-purple data-checked:bg-agent-purple dark:data-checked:bg-agent-purple",
}

export function ColourSwatches({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">
        <span id="agent-colour-label">Colour</span>
        <span aria-hidden="true" className="mx-1.5 text-muted-foreground">
          ·
        </span>
        <span className="font-normal text-muted-foreground">{value}</span>
      </FieldLegend>
      <RadioGroup
        aria-labelledby="agent-colour-label"
        value={value}
        onValueChange={(next) => onChange(String(next))}
        className="flex flex-wrap gap-3"
      >
        {Object.entries(SWATCHES).map(([colour, fill]) => (
          <RadioGroupItem
            key={colour}
            value={colour}
            aria-label={colour}
            className={`size-7 border-transparent data-checked:border-transparent data-checked:ring-2 data-checked:ring-foreground-strong data-checked:ring-offset-2 data-checked:ring-offset-background [&_[data-slot=radio-group-indicator]]:hidden ${fill}`}
          />
        ))}
      </RadioGroup>
    </FieldSet>
  )
}
