import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { Json, QuestionItem } from "@/lib/agent-api"

type Question = {
  question: string
  header: string
  options: { label: string; description: string }[]
}

export function QuestionCard({
  card,
  onAnswer,
}: {
  card: QuestionItem
  onAnswer: (requestId: string, answer: RequestAnswer) => void
}) {
  const questions = card.questions.map(toQuestion)
  const [chosen, setChosen] = useState<Record<string, string>>({})

  function choose(question: string, label: string) {
    const next = { ...chosen, [question]: label }
    setChosen(next)
    if (questions.every((item) => next[item.question])) {
      onAnswer(card.requestId, { answers: next })
    }
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      {questions.map((item) => (
        <section
          key={item.question}
          aria-label={item.question}
          className="flex flex-col gap-2 rounded-[14px] border bg-rail px-3 py-2"
        >
          <span className="text-xs text-foreground-faint">{item.header}</span>
          <p className="m-0 font-medium text-foreground-strong">
            {item.question}
          </p>
          {card.status === "pending" ? (
            <div className="flex flex-wrap gap-2">
              {item.options.map((option) => (
                <Button
                  key={option.label}
                  variant={
                    chosen[item.question] === option.label
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  title={option.description}
                  onClick={() => choose(item.question, option.label)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              {card.status === "answered"
                ? `Your answer: ${card.answers?.[item.question] ?? ""}`
                : "Expired"}
            </span>
          )}
        </section>
      ))}
    </div>
  )
}

function toQuestion(value: Json): Question {
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
