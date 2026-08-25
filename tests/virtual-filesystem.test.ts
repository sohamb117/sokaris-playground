import { describe, expect, it } from "vitest"

import {
  BrowserImageFileSystem,
  normalizeVirtualPath,
  VirtualPathError,
} from "../src/runtime/virtual-filesystem.ts"

const image = (filename: string, value: number) => ({
  filename,
  width: 1,
  height: 1,
  data: new Uint8ClampedArray([value, value, value, 255]),
})

describe("virtual image paths", () => {
  it("normalizes separators and current-directory components", () => {
    expect(normalizeVirtualPath("./inputs\\demo/./input.png")).toBe("inputs/demo/input.png")
  })

  it.each(["", "/input.png", "C:/input.png", "../input.png", "a/../../input.png", "a//b", "a\0b"])(
    "rejects unsafe path %j",
    (path) => {
      expect(() => normalizeVirtualPath(path)).toThrow(VirtualPathError)
    },
  )

  it("preserves case-sensitive path identity", () => {
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([image("input.png", 1), image("Input.png", 2)])

    expect(filesystem.load("input.png").data[0]).toBe(1)
    expect(filesystem.load("Input.png").data[0]).toBe(2)
  })
})

describe("browser image filesystem", () => {
  it("replaces duplicate input data without moving insertion order", () => {
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([image("first.png", 1), image("second.png", 2)])

    filesystem.replaceInputs([image("first.png", 3)])

    expect(filesystem.inputs().map(({ filename }) => filename)).toEqual(["first.png", "second.png"])
    expect(filesystem.load("first.png").data[0]).toBe(3)
  })

  it("publishes staged outputs atomically in first-save order", () => {
    const filesystem = new BrowserImageFileSystem()
    const run = filesystem.beginRun()

    run.save("results/first.png", image("ignored.png", 1))
    run.save("results/second.png", image("ignored.png", 2))
    run.save("results/first.png", image("ignored.png", 3))
    expect(filesystem.outputs()).toEqual([])

    run.commit()

    expect(filesystem.outputs().map(({ filename }) => filename)).toEqual([
      "results/first.png",
      "results/second.png",
    ])
    expect(filesystem.load("results/first.png").data[0]).toBe(3)
  })

  it("retains prior outputs when a run rolls back", () => {
    const filesystem = new BrowserImageFileSystem()
    const successful = filesystem.beginRun()
    successful.save("output.png", image("ignored.png", 1))
    successful.commit()

    const failed = filesystem.beginRun()
    failed.save("replacement.png", image("ignored.png", 2))
    failed.rollback()

    expect(filesystem.outputs().map(({ filename }) => filename)).toEqual(["output.png"])
    expect(filesystem.load("output.png").data[0]).toBe(1)
  })

  it("lets committed outputs shadow inputs without losing input provenance", () => {
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([image("shared.png", 1)])
    const run = filesystem.beginRun()
    run.save("shared.png", image("ignored.png", 2))
    run.commit()

    expect(filesystem.load("shared.png").data[0]).toBe(2)
    expect(filesystem.inputs()[0]?.data[0]).toBe(1)
    expect(filesystem.outputs()[0]?.data[0]).toBe(2)
  })
})
