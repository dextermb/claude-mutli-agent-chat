import { readFileSync, writeFileSync } from "node:fs"

const mode = process.env.FAKE_SUMMARIZER_MODE ?? "play"
const log = process.env.FAKE_SUMMARIZER_LOG

let input = ""
for await (const chunk of process.stdin) input += String(chunk)

if (log) {
  writeFileSync(log, JSON.stringify({ args: process.argv.slice(2), input }))
}
if (mode === "fail") {
  process.stderr.write("fake summarizer: fail\n")
  process.exit(1)
}
if (mode === "hang") setInterval(() => undefined, 1000)
else {
  process.stdout.write(
    readFileSync(
      new URL("../protocol/fixtures/summarize.json", import.meta.url),
      "utf8"
    )
  )
}
