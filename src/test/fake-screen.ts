import { vi } from "vitest"

export function screenWidth(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query)
    return {
      media: query,
      matches: maxWidth !== null && width <= Number(maxWidth[1]),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
  })
}

export function windowFocus(focused: boolean) {
  vi.spyOn(document, "hasFocus").mockReturnValue(focused)
}
