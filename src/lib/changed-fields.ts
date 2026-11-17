export function changedFields<T extends object>(values: T, saved: T) {
  return (Object.keys(saved) as (keyof T)[]).filter(
    (name) =>
      JSON.stringify(values[name] ?? null) !==
      JSON.stringify(saved[name] ?? null)
  )
}

export function unsavedText(count: number) {
  if (count === 0) return "All changes are saved."
  return count === 1 ? "1 unsaved change" : `${count} unsaved changes`
}
