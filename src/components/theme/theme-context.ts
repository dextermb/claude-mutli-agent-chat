import { createContext } from "react"

import type { Theme } from "@/lib/theme"

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<
  ThemeProviderState | undefined
>(undefined)
