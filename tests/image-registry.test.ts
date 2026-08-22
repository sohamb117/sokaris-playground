import { describe, expect, it } from "vitest"

import { ImageRegistry } from "../src/ui/image-registry.ts"

const image = (filename: string, value: number) => ({
  filename,
  width: 1,
  height: 1,
  data: new Uint8ClampedArray([value, value, value, 255]),
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

  it("makes the most recently inserted or replaced image active", () => {
    // Given
    const registry = new ImageRegistry()
    registry.replace([image("first.png", 0), image("second.png", 64)])

    // When
    registry.replace([image("first.png", 255)])

    // Then
    expect(registry.active()).toEqual(image("first.png", 255))
    expect(registry.list().map(({ filename }) => filename)).toEqual(["first.png", "second.png"])
  })
})
