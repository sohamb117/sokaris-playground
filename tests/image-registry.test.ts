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

  it("atomically replaces outputs and selects the last saved artifact", () => {
    // Given
    const registry = new ImageRegistry()
    registry.replace([image("input.png", 0)])
    registry.replaceOutputs([image("old.png", 64)])

    // When
    registry.replaceOutputs([image("results/first.png", 128), image("results/last.png", 255)])

    // Then
    expect(registry.outputs().map(({ filename }) => filename)).toEqual([
      "results/first.png",
      "results/last.png",
    ])
    expect(registry.selected()).toEqual({
      provenance: "output",
      image: image("results/last.png", 255),
    })
  })

  it("selects an input without changing runtime input order", () => {
    // Given
    const registry = new ImageRegistry()
    registry.replace([image("first.png", 0), image("second.png", 64)])

    // When
    const selected = registry.select("input", "first.png")

    // Then
    expect(selected).toEqual(image("first.png", 0))
    expect(registry.selected()).toEqual({ provenance: "input", image: image("first.png", 0) })
    expect(registry.list().map(({ filename }) => filename)).toEqual(["first.png", "second.png"])
  })

  it("retains outputs and selection when no replacement is committed", () => {
    // Given
    const registry = new ImageRegistry()
    registry.replace([image("input.png", 0)])
    registry.replaceOutputs([image("output.png", 255)])

    // When
    const retained = registry.selected()

    // Then
    expect(registry.outputs()).toEqual([image("output.png", 255)])
    expect(retained).toEqual({ provenance: "output", image: image("output.png", 255) })
  })
})
