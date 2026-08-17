import { describe, expect, it } from "vitest"

import { toRgbaBytes } from "../src/ui/canvas-painter.ts"

describe("canvas painter", () => {
  it("rounds normalized channels to exact bytes", () => {
    // Given
    const channels = new Float64Array([0, 0.5, 1, 0.25])

    // When
    const result = toRgbaBytes({ width: 1, height: 1, data: channels })

    // Then
    expect(result).toEqual(new Uint8ClampedArray([0, 128, 255, 64]))
  })

  it("rejects channel values outside the normalized range", () => {
    // Given
    const channels = new Float64Array([0, -0.1, 1.1, 1])

    // When / Then
    expect(() => toRgbaBytes({ width: 1, height: 1, data: channels })).toThrow(
      "Image channels must be finite values from 0 to 1",
    )
  })
})
