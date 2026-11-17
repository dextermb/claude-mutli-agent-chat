import "@testing-library/jest-dom/vitest"
import { cleanup, configure } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import { fakeScrollTo } from "@/test/fake-layout"
import { screenWidth, windowFocus } from "@/test/fake-screen"

fakeScrollTo()
configure({ asyncUtilTimeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  screenWidth(1280)
  windowFocus(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
