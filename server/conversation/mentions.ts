export type Mentionable = { key: string; name: string }

export function parseMentions(text: string, members: Mentionable[]): string[] {
  const found: { key: string; at: number }[] = []
  for (const member of members) {
    const match = mentionPattern(member.name).exec(text)
    if (match) found.push({ key: member.key, at: match.index })
  }
  return found.sort((a, b) => a.at - b.at).map((mention) => mention.key)
}

export function mentionPattern(name: string, flags = ""): RegExp {
  return new RegExp(
    `(?<![\\w@-])@${escapeRegExp(name)}(?![\\w/-]|\\.[A-Za-z])`,
    flags
  )
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
