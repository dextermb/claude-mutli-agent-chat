import { Button } from "@/components/ui/button"
import { useSessionLog } from "@/hooks/use-session-log"
import { prettyLine, summaryOf } from "@/lib/log-lines"
import { clockSeconds, clockTime } from "@/lib/time"

export function SessionLogTab({
  conversationId,
  agentId,
}: {
  conversationId: string
  agentId: string
}) {
  const { lines, more, loadEarlier } = useSessionLog(conversationId, agentId)
  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      {more && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => void loadEarlier()}
        >
          Load earlier lines
        </Button>
      )}
      <ol
        aria-label="Session log"
        className="m-0 flex list-none flex-col gap-0.5 p-0 font-mono text-xs"
      >
        {lines.map((line, index) => (
          <LogRow
            key={line.seq}
            line={line}
            startsProcess={lines[index - 1]?.sessionId !== line.sessionId}
          />
        ))}
      </ol>
    </div>
  )
}

function LogRow({
  line,
  startsProcess,
}: {
  line: { sessionId: string; direction: string; at: string; text: string }
  startsProcess: boolean
}) {
  return (
    <>
      {startsProcess && (
        <li className="mt-2 border-t pt-2">
          <p className="m-0 text-foreground-faint">
            {`Process started · ${clockTime(line.at)}`}
          </p>
        </li>
      )}
      <li>
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            {`${clockSeconds(line.at)} ${line.direction} ${summaryOf(line.text)}`}
          </summary>
          <pre className="m-0 overflow-x-auto rounded-[10px] border bg-rail p-2 whitespace-pre-wrap">
            {prettyLine(line.text)}
          </pre>
        </details>
      </li>
    </>
  )
}
