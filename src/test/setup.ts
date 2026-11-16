import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import { fakeScrollTo } from "@/test/fake-layout"
import { screenWidth, windowFocus } from "@/test/fake-screen"

fakeScrollTo()

beforeEach(() => {
  screenWidth(1280)
  windowFocus(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
