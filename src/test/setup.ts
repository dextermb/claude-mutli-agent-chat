import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import { screenWidth } from "@/test/fake-screen"

beforeEach(() => {
  screenWidth(1280)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
