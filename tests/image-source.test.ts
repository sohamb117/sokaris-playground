import { describe, expect, it } from "vitest"

import { marshalImageBindings } from "../src/runtime/image-source.ts"

describe("browser image source marshalling", () => {
  it("escapes hostile filenames and emits normalized row-major RGBA", () => {
    // Given
    const images = [
      {
        filename: 'hostile"$(error(1))\\\n.png',
        width: 1,
        height: 1,
        data: new Float64Array([0, 0.25, 0.5, 1]),
      },
    ]

    // When
    const source = marshalImageBindings(images)

    // Then
    expect(source).toContain(String.raw`name == "hostile\"\$(error(1))\\\n.png"`)
    expect(source).toContain("BrowserImage(1, 1, Float64[0, 0.25, 0.5, 1])")
    expect(source).toContain("Sokaris subset error: image '" + '" * name * "' + "' is not loaded.")
  })

  it("rejects a channel outside the normalized range", () => {
    // Given
    const image = {
      filename: "bad.png",
      width: 1,
      height: 1,
      data: new Float64Array([0, 0, 2, 1]),
    }

    // When
    const marshal = () => marshalImageBindings([image])

    // Then
    expect(marshal).toThrow("RGBA channels must be finite values in [0, 1]")
  })
})
