import type { Json } from "@/lib/agent-api"

export type Question = {
  question: string
  header: string
  options: { label: string; description: string }[]
}

export function toQuestion(value: Json): Question {
  const options = Array.isArray(value.options) ? value.options : []
  return {
    question: String(value.question ?? ""),
    header: String(value.header ?? ""),
    options: options.map((option: Json) => ({
      label: String(option.label ?? ""),
      description: String(option.description ?? ""),
    })),
  }
}
