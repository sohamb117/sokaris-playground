import { describe, expect, it } from "vitest"

import { ImageRegistry } from "../src/ui/image-registry.ts"

const image = (filename: string, value: number) => ({
  filename,
  width: 1,
  height: 1,
  data: new Float64Array([value, value, value, 1]),
})

describe("image registry", () => {
  it("replaces duplicate image data without changing insertion order", () => {
    // Given
    const registry = new ImageRegistry()
    registry.replace([image("first.png", 0), image("second.png", 0.5)])

    // When
    registry.replace([image("first.png", 1)])

    // Then
    expect(registry.list().map(({ filename }) => filename)).toEqual(["first.png", "second.png"])
    expect(registry.list()[0]?.data[0]).toBe(1)
  })
})
