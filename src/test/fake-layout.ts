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

type ScrollSize = { scrollHeight: number; clientHeight: number }

export function scrollLayout(size: (element: Element) => ScrollSize) {
  const tops = new WeakMap<Element, number>()
  const maxTop = (element: Element) => {
    const { scrollHeight, clientHeight } = size(element)
    return Math.max(0, scrollHeight - clientHeight)
  }
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(
    function (this: Element) {
      return size(this).scrollHeight
    }
  )
  vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(
    function (this: Element) {
      return size(this).clientHeight
    }
  )
  vi.spyOn(Element.prototype, "scrollTop", "get").mockImplementation(function (
    this: Element
  ) {
    return Math.min(tops.get(this) ?? 0, maxTop(this))
  })
  vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(function (
    this: Element,
    top: number
  ) {
    tops.set(this, Math.min(Math.max(0, top), maxTop(this)))
  })
}

export function userScroll(element: Element, top: number) {
  act(() => {
    element.scrollTop = top
    element.dispatchEvent(new Event("scroll"))
  })
}

export function fakeScrollTo() {
  if ("scrollTo" in Element.prototype) return
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value(this: Element, options: ScrollToOptions) {
      if (options.top !== undefined) this.scrollTop = options.top
      this.dispatchEvent(new Event("scroll"))
    },
  })
}
