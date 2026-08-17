import { describe, expect, it } from "vitest"

import { parseExecutionResult, parseFinalImage } from "../src/runtime/result-parser.ts"

describe("sentinel image parser", () => {
  it("uses the final complete image block", () => {
    // Given
    const output = [
      "__SOKARIS_IMAGE_BEGIN__\n1,1,0,0,0,1\n__SOKARIS_IMAGE_END__",
      "noise __SOKARIS_IMAGE_BEGIN__\n2,1,1,0,0,1,0,1,0,1\n__SOKARIS_IMAGE_END__ trailing",
    ].join("\n")

    // When
    const result = parseFinalImage(output)

    // Then
    expect(result).toEqual({
      width: 2,
      height: 1,
      data: new Float64Array([1, 0, 0, 1, 0, 1, 0, 1]),
    })
  })

  it("rejects a sentinel whose channel count does not match its dimensions", () => {
    // Given
    const output = "__SOKARIS_IMAGE_BEGIN__\n2,2,0,0,0,1\n__SOKARIS_IMAGE_END__"

    // When
    const parse = () => parseFinalImage(output)

    // Then
    expect(parse).toThrow("expected 16 RGBA channels, received 4")
  })
})

describe("VM execution result parser", () => {
  it("narrows an unknown successful scalar result", () => {
    // Given
    const raw: unknown = { success: true, value: 42, output: "", error_message: null }

    // When
    const result = parseExecutionResult(raw)

    // Then
    expect(result).toEqual({ kind: "scalar", value: 42, output: "" })
  })

  it("returns an explicit VM error from an unknown failed result", () => {
    // Given
    const raw: unknown = {
      success: false,
      value: Number.NaN,
      output: "",
      error_message: "Sokaris subset error: gaussian is not supported by SubsetJuliaVM v0.12.2.",
    }

    // When
    const result = parseExecutionResult(raw)

    // Then
    expect(result).toEqual({
      kind: "error",
      message: "Sokaris subset error: gaussian is not supported by SubsetJuliaVM v0.12.2.",
      output: "",
    })
  })
})
