import { describe, expect, it } from "vitest"
import { COMPILER_REFERENCE, PROGRAM_RULES, RUNTIME_LIMITS } from "../src/ui/help-content.ts"

describe("help content", () => {
  it("documents the compiler contract without built-in image transforms", () => {
    // Given / When
    const content = [
      ...COMPILER_REFERENCE.map((entry) => `${entry.signature} ${entry.description}`),
      ...PROGRAM_RULES,
      ...RUNTIME_LIMITS,
    ].join(" ")

    // Then
    expect(content).toContain("main!(pixels::Vector{UInt8})")
    expect(content).toContain("native resolution")
    expect(content).toContain("scalar interpreter")
    expect(content).not.toContain("posterize")
  })
})
