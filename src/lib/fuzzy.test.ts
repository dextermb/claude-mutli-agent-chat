import { describe, expect, it } from "vitest"

import { fuzzyFilter } from "@/lib/fuzzy"

describe("fuzzyFilter", () => {
  const names = ["claude-multi-agent", "node_modules", "docs", "src"]

  it("returns every name for an empty query", () => {
    expect(fuzzyFilter("", names)).toEqual(names)
  })

  it("matches letters that appear in order but not together", () => {
    expect(fuzzyFilter("cma", names)).toEqual(["claude-multi-agent"])
  })

  it("ignores case", () => {
    expect(fuzzyFilter("DOCS", names)).toEqual(["docs"])
  })

  it("drops names that do not contain the letters in order", () => {
    expect(fuzzyFilter("scd", names)).toEqual([])
  })

  it("ranks a tighter match before a looser one", () => {
    expect(fuzzyFilter("mod", ["m-o-d-x", "node_modules", "mod"])).toEqual([
      "mod",
      "node_modules",
      "m-o-d-x",
    ])
  })
})
