function spanOf(query: string, text: string) {
  const lowerText = text.toLowerCase()
  let from = 0
  let first = -1
  let last = -1
  for (const letter of query.toLowerCase()) {
    const at = lowerText.indexOf(letter, from)
    if (at === -1) return null
    if (first === -1) first = at
    last = at
    from = at + 1
  }
  return { start: first, length: last - first + 1 }
}

export function fuzzyFilter(query: string, names: string[]) {
  if (query === "") return names
  const matches: { name: string; start: number; length: number }[] = []
  for (const name of names) {
    const span = spanOf(query, name)
    if (span) matches.push({ name, ...span })
  }
  matches.sort((a, b) => a.length - b.length || a.start - b.start)
  return matches.map((match) => match.name)
}
