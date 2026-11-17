type FieldMeta = { isTouched: boolean; errors: unknown[] }

export function shown(meta: FieldMeta): { message?: string }[] {
  if (!meta.isTouched) return []
  return meta.errors.map((error) =>
    typeof error === "string"
      ? { message: error }
      : (error as { message?: string })
  )
}

export function invalid(meta: FieldMeta): boolean {
  return shown(meta).length > 0
}

export function fixText(labels: string[]): string {
  const fields = labels.length === 1 ? "1 field" : `${labels.length} fields`
  return `Fix ${fields}: ${labels.join(", ")}.`
}
