import { describe, expect, it } from "vitest"

import { fileToRoutePath } from "@/router/file-routes"

describe("fileToRoutePath", () => {
  it("maps the root index file to the root URL", () => {
    expect(fileToRoutePath("index.tsx")).toBe("/")
  })

  it("maps a static file to a URL with the same name", () => {
    expect(fileToRoutePath("about.tsx")).toBe("/about")
  })

  it("maps a nested index file to its folder URL", () => {
    expect(fileToRoutePath("blog/index.tsx")).toBe("/blog")
  })

  it("maps a bracketed file name to a URL parameter", () => {
    expect(fileToRoutePath("users/[id].tsx")).toBe("/users/:id")
  })
})
