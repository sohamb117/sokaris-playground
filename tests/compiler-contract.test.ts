import { describe, expect, it, vi } from "vitest"

import {
  executeCompiledImage,
  formatCompilerDiagnostics,
  parseCompilerResult,
} from "../src/runtime/compiler-contract.ts"

describe("compiler result contract", () => {
  it("parses validated ABI v1 compiler bytes", () => {
    // Given
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])

    // When
    const result = parseCompilerResult({
      success: true,
      wasm_bytes: bytes,
      diagnostics: [],
      compiler_version: "0.11.1",
      abi_version: 1,
    })

    // Then
    expect(result).toEqual({ bytes, compilerVersion: "0.11.1", abiVersion: 1 })
  })

  it("rejects invalid success bytes", () => {
    // Given / When
    const parse = () =>
      parseCompilerResult({
        success: true,
        wasm_bytes: new Uint8Array([1, 2, 3]),
        diagnostics: [],
        compiler_version: "0.11.1",
        abi_version: 1,
      })

    // Then
    expect(parse).toThrow("Compiler returned invalid WebAssembly bytes")
  })

  it("formats diagnostic kind, message, and source span", () => {
    // Given
    const result = {
      success: false,
      wasm_bytes: new Uint8Array(),
      diagnostics: [
        {
          kind: "unsupported",
          message: "dynamic String is unsupported",
          span: { start_line: 2, start_column: 3, end_line: 2, end_column: 9 },
        },
      ],
      compiler_version: "0.11.1",
      abi_version: 1,
    }

    // When / Then
    expect(formatCompilerDiagnostics(result)).toBe(
      "unsupported: dynamic String is unsupported (2:3-2:9)",
    )
  })
})

describe("generated image ABI", () => {
  it("grows memory, writes ABI v1 descriptor, invokes main!, and copies output", async () => {
    // Given
    const memory = new WebAssembly.Memory({ initial: 1 })
    const main = vi.fn((descriptorPointer: number) => {
      const descriptor = new DataView(memory.buffer, descriptorPointer, 20)
      expect(
        Array.from({ length: 5 }, (_, index) => descriptor.getUint32(index * 4, true)),
      ).toEqual([1, 64, 70_000, 1, 1])
      new Uint8Array(memory.buffer, 64, 70_000).fill(42)
    })
    const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
    const instantiate = vi.spyOn(WebAssembly, "instantiate").mockResolvedValue({
      exports: {
        memory,
        "main!": main,
        __sjulia_wasm_abi_version: () => 1,
      },
    })
    const input = new Uint8ClampedArray(70_000)

    // When
    const result = await executeCompiledImage(module, {
      filename: "large.png",
      width: 175,
      height: 100,
      data: input,
    })

    // Then
    expect(main).toHaveBeenCalledWith(32)
    expect(result.data).toEqual(new Uint8ClampedArray(70_000).fill(42))
    expect(result.data.buffer).not.toBe(memory.buffer)
    instantiate.mockRestore()
  })

  it("reads output from the current memory buffer after main! grows memory", async () => {
    // Given
    const memory = new WebAssembly.Memory({ initial: 1 })
    const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
    const instantiate = vi.spyOn(WebAssembly, "instantiate").mockResolvedValue({
      exports: {
        memory,
        "main!": () => {
          memory.grow(1)
          new Uint8Array(memory.buffer, 64, 4).set([9, 8, 7, 6])
        },
        __sjulia_wasm_abi_version: () => 1,
      },
    })

    // When
    const result = await executeCompiledImage(module, {
      filename: "grow.png",
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([1, 2, 3, 4]),
    })

    // Then
    expect(result.data).toEqual(new Uint8ClampedArray([9, 8, 7, 6]))
    instantiate.mockRestore()
  })

  it.each([
    { width: 0, height: 1, data: new Uint8ClampedArray() },
    { width: 1.5, height: 1, data: new Uint8ClampedArray(4) },
    { width: Number.MAX_SAFE_INTEGER + 1, height: 2, data: new Uint8ClampedArray(4) },
  ])("rejects unsafe image dimensions $width x $height", async (image) => {
    // Given
    const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

    // When / Then
    await expect(
      executeCompiledImage(module, { filename: "unsafe.png", ...image }),
    ).rejects.toThrow("Image dimensions must be positive safe integers")
  })

  it("rejects an image above the bounded RGBA allocation", async () => {
    // Given
    const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

    // When / Then
    await expect(
      executeCompiledImage(module, {
        filename: "huge.png",
        width: 8_193,
        height: 8_193,
        data: new Uint8ClampedArray(4),
      }),
    ).rejects.toThrow("Image exceeds the 256 MiB RGBA limit")
  })
})
