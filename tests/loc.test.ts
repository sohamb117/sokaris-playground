import { describe, expect, it } from "vitest"

import { countPureLines } from "../scripts/check-loc.ts"

describe("source line counter", () => {
  it("excludes blank and comment-only lines", () => {
    // Given
    const source = ["const value = 1", "", "// comment", "  ", "value.toString()"].join("\n")

    // When
    const result = countPureLines(source)

    // Then
    expect(result).toBe(2)
  })
})
