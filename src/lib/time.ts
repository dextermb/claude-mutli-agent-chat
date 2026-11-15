const CLOCK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export function clockTime(iso: string): string {
  return CLOCK.format(new Date(iso))
}

const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

export function longDay(iso: string): string {
  return DAY.format(new Date(iso))
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

export function dayName(iso: string, now = new Date()): string {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(iso) === now.toDateString()) return "Today"
  if (dayKey(iso) === yesterday.toDateString()) return "Yesterday"
  return longDay(iso)
}

const CLOCK_SECONDS = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

export function clockSeconds(iso: string): string {
  return CLOCK_SECONDS.format(new Date(iso))
}
