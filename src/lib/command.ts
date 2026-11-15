const PLAIN = /^[\w./:=@%+,-]+$/

export function commandText(command: string, args: string[]): string {
  const groups: string[][] = []
  for (const arg of args) {
    if (arg.startsWith("-") || groups.length === 0) groups.push([])
    groups[groups.length - 1].push(quoted(arg))
  }
  const [first = [], ...rest] = groups
  return [[command, ...first], ...rest.map((group) => ["", ...group])]
    .map((words) => words.join(" ").replace(/^ /, "  "))
    .join(" \\\n")
}

function quoted(arg: string): string {
  return PLAIN.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`
}
