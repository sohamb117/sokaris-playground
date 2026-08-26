import { describe, expect, it } from "vitest"
import { STARTER_FILENAME, STARTER_SOURCE } from "../src/examples/starter.ts"

describe("starter content", () => {
  it("exports the bundled filename and exact raw starter program", () => {
    // Given / When
    const starter = { filename: STARTER_FILENAME, source: STARTER_SOURCE }

    // Then
    expect(starter).toEqual({
      filename: "input.png",
      source: `image = load("input.png")
result = image ▷ invert ▷ gamma(0.85) ▷ noise(0.1) ▷ gaussian(2) ▷ 𓇬
save("output.png", result)`,
    })
  })
})
