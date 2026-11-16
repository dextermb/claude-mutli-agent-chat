export type Mentionable = { key: string; name: string }

export function parseMentions(text: string, members: Mentionable[]): string[] {
  const found: { key: string; at: number }[] = []
  for (const member of members) {
    const pattern = new RegExp(
      `(?<![\\w@-])@${escapeRegExp(member.name)}(?![\\w/-]|\\.[A-Za-z])`
    )
    const match = pattern.exec(text)
    if (match) found.push({ key: member.key, at: match.index })
  }
  return found.sort((a, b) => a.at - b.at).map((mention) => mention.key)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
