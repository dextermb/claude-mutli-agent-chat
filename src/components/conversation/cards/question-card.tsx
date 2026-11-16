import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type { QuestionItem } from "@/lib/agent-api"
import { toQuestion } from "@/lib/question"

export function QuestionCard({
  card,
  onAnswer,
}: {
  card: QuestionItem
  onAnswer: (requestId: string, answer: RequestAnswer) => Promise<boolean>
}) {
  const questions = card.questions.map(toQuestion)
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  function choose(question: string, label: string) {
    const next = { ...chosen, [question]: label }
    setChosen(next)
    if (questions.every((item) => next[item.question])) {
      setSending(true)
      void onAnswer(card.requestId, { answers: next }).then((taken) => {
        if (!taken) setSending(false)
      })
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
                  disabled={sending}
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
