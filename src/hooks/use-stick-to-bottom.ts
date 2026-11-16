import { useCallback, useLayoutEffect, useRef, useState } from "react"

const NEAR_BOTTOM = 24
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

export function useStickToBottom(key: string) {
  const scrollElement = useRef<HTMLElement | null>(null)
  const stuck = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  const [stuckKey, setStuckKey] = useState(key)
  if (stuckKey !== key) {
    setStuckKey(key)
    setAtBottom(true)
  }

  const stick = useCallback((value: boolean) => {
    stuck.current = value
    setAtBottom(value)
  }, [])

  const keepAtBottom = useCallback(() => {
    const element = scrollElement.current
    if (element && stuck.current) element.scrollTop = element.scrollHeight
  }, [])

  useLayoutEffect(() => {
    stuck.current = true
    keepAtBottom()
  }, [key, keepAtBottom])

  const scrollRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return
      scrollElement.current = element
      stick(true)
      keepAtBottom()
      let lastTop = element.scrollTop
      const onScroll = () => {
        const top = element.scrollTop
        const distance = element.scrollHeight - top - element.clientHeight
        if (distance <= NEAR_BOTTOM) stick(true)
        else if (top < lastTop) stick(false)
        lastTop = top
      }
      element.addEventListener("scroll", onScroll, { passive: true })
      const stopObserving = observeSize(element, keepAtBottom)
      return () => {
        element.removeEventListener("scroll", onScroll)
        stopObserving()
        scrollElement.current = null
      }
    },
    [stick, keepAtBottom]
  )

  const contentRef = useCallback(
    (element: HTMLElement | null) =>
      element ? observeSize(element, keepAtBottom) : undefined,
    [keepAtBottom]
  )

  const jumpToBottom = useCallback(() => {
    const element = scrollElement.current
    if (!element) return
    stick(true)
    element.scrollTo({
      top: element.scrollHeight,
      behavior: window.matchMedia(REDUCED_MOTION).matches
        ? "instant"
        : "smooth",
    })
  }, [stick])

  return { scrollRef, contentRef, atBottom, jumpToBottom }
}

function observeSize(element: HTMLElement, onResize: () => void) {
  if (typeof ResizeObserver === "undefined") return () => undefined
  const observer = new ResizeObserver(onResize)
  observer.observe(element)
  return () => observer.disconnect()
}
