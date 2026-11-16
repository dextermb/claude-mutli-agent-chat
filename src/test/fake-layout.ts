import { act } from "@testing-library/react"
import { vi } from "vitest"

const observers = new Set<FakeResizeObserver>()

class FakeResizeObserver {
  private readonly targets = new Set<Element>()
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    observers.add(this)
  }

  observe(target: Element) {
    this.targets.add(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
    observers.delete(this)
  }

  resize() {
    if (this.targets.size === 0) return
    const entries = [...this.targets].map(
      (target) => ({ target }) as ResizeObserverEntry
    )
    this.callback(entries, this as unknown as ResizeObserver)
  }
}

export function fakeResizeObserver() {
  observers.clear()
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
}

export function elementHeight(height: (element: HTMLElement) => number) {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return height(this)
    }
  )
}

export function resizeAll() {
  act(() => {
    for (const observer of observers) observer.resize()
  })
}
