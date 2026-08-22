import { describe, expect, it } from "vitest"

import { routeSource } from "../src/runtime/source-route.ts"

describe("runtime source routing", () => {
  it("routes main! programs to the compiler", () => {
    // Given
    const source = "function main!(pixels::Vector{UInt8})\nend"

    // When / Then
    expect(routeSource(source)).toBe("compiler")
  })

  it("routes scalar programs to the compatibility interpreter", () => {
    // Given / When / Then
    expect(routeSource("result = 6 * 7")).toBe("interpreter")
  })

  it("rejects image loading without main! migration", () => {
    // Given / When / Then
    expect(routeSource('result = load("input.png")')).toBe("image-migration-error")
  })
})
