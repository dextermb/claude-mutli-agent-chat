export type SummaryInput = { earlier: string | null; lines: string[] }

export type Summary = { text: string; costUsd: number }

export type Summarize = (input: SummaryInput) => Promise<Summary | null>
