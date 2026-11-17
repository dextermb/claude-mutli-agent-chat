import { Badge } from "@/components/ui/badge"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const MODES = [
  "manual",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
]

const MODE_NOTES: Record<string, string> = {
  manual:
    "With manual, each tool outside the allowed list waits for approval in the chat.",
  acceptEdits:
    "acceptEdits changes files without a prompt. Other tools outside the allowed list wait for approval in the chat.",
  plan: "plan reads and plans, and changes no file. Other tools outside the allowed list wait for approval in the chat.",
  auto: "auto lets a classifier decide each tool outside the allowed list. A tool that the classifier refuses does not run and shows as failed in the chat, with no approval card.",
  dontAsk:
    "dontAsk never asks for approval. A tool outside the allowed list does not run and shows as failed in the chat. Read-only commands, such as ls, still run.",
  bypassPermissions:
    "bypassPermissions runs each tool without a prompt. Blocked tools still never run.",
}

export function ModeChoice({
  value,
  errors = [],
  onChange,
}: {
  value: string
  errors?: { message?: string }[]
  onChange: (value: string) => void
}) {
  return (
    <FieldSet data-invalid={errors.length > 0}>
      <FieldLegend id="agent-mode-label" variant="label">
        Permission mode
      </FieldLegend>
      <RadioGroup
        aria-labelledby="agent-mode-label"
        value={value}
        onValueChange={(next) => onChange(String(next))}
      >
        {MODES.map((mode) => (
          <FieldLabel key={mode} htmlFor={`agent-mode-${mode}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>
                  <span id={`agent-mode-${mode}-title`} className="font-mono">
                    {mode}
                  </span>
                  {mode === "bypassPermissions" && (
                    <Badge variant="destructive">No prompts</Badge>
                  )}
                </FieldTitle>
                <FieldDescription id={`agent-mode-${mode}-note`}>
                  {MODE_NOTES[mode]}
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={mode}
                id={`agent-mode-${mode}`}
                aria-labelledby={`agent-mode-${mode}-title`}
                aria-describedby={`agent-mode-${mode}-note`}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      <FieldError errors={errors} />
    </FieldSet>
  )
}
