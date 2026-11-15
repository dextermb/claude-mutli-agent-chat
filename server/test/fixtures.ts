import { readFileSync } from "node:fs"

type Envelope = { dir: "in" | "out"; line: Record<string, unknown> }

const FIXTURES = new URL("../protocol/fixtures/", import.meta.url)

export function readFixture(name: string): Envelope[] {
  return readFileSync(new URL(`${name}.jsonl`, FIXTURES), "utf8")
    .split("\n")
    .filter((text) => text.trim() !== "")
    .map((text) => JSON.parse(text) as Envelope)
}

export function stdoutLines(name: string): string[] {
  return readFixture(name)
    .filter((envelope) => envelope.dir === "out")
    .map((envelope) => JSON.stringify(envelope.line))
}

export function stdinLines(name: string): Record<string, unknown>[] {
  return readFixture(name)
    .filter((envelope) => envelope.dir === "in")
    .map((envelope) => envelope.line)
}
