import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import { screenWidth, windowFocus } from "@/test/fake-screen"

beforeEach(() => {
  screenWidth(1280)
  windowFocus(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
