import { describe, expect, it, vi } from "vitest"

import {
  executeCompiledImage,
  formatCompilerDiagnostics,
  parseCompilerResult,
} from "../src/runtime/compiler-contract.ts"

describe("compiler result contract", () => {
  it("parses validated ABI v2 compiler bytes", () => {
    // Given
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])

    // When
    const result = parseCompilerResult({
      success: true,
      wasm_bytes: bytes,
      diagnostics: [],
      compiler_version: "0.11.1",
      abi_version: 2,
    })

    // Then
    expect(result).toEqual({
      bytes,
      compilerVersion: "0.11.1",
      abiVersion: 2,
      entryPoint: undefined,
      imports: [],
    })
  })

  it("parses script entry and typed host import metadata", () => {
    // Given
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])

    // When
    const result = parseCompilerResult({
      success: true,
      wasm_bytes: bytes,
      diagnostics: [],
      compiler_version: "0.11.1",
      abi_version: 2,
      entry_point: "__sjulia_script_entry",
      imports: [
        {
          module: "sjulia_host",
          name: "load",
          function_name: "__sjulia_host_load",
          params: ["String", "Int64", "Int64"],
          result: "Int64",
        },
      ],
    })

    // Then
    expect(result.entryPoint).toBe("__sjulia_script_entry")
    expect(result.imports).toEqual([
      {
        module: "sjulia_host",
        name: "load",
        functionName: "__sjulia_host_load",
        params: ["String", "Int64", "Int64"],
        result: "Int64",
      },
    ])
  })

  it("rejects malformed host import metadata", () => {
    const parse = () =>
      parseCompilerResult({
        success: true,
        wasm_bytes: new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
        diagnostics: [],
        compiler_version: "0.11.1",
        abi_version: 2,
        imports: [{ module: "sjulia_host", name: "load", params: [42] }],
      })

    expect(parse).toThrow("Compiler returned invalid import metadata")
  })

  it("rejects invalid success bytes", () => {
    // Given / When
    const parse = () =>
      parseCompilerResult({
        success: true,
        wasm_bytes: new Uint8Array([1, 2, 3]),
        diagnostics: [],
        compiler_version: "0.11.1",
        abi_version: 2,
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
      abi_version: 2,
    }

    // When / Then
    expect(formatCompilerDiagnostics(result)).toBe(
      "unsupported: dynamic String is unsupported (2:3-2:9)",
    )
  })
})

describe("generated image ABI", () => {
  it("allocates an ABI v2 descriptor, invokes main!, copies output, and cleans up", async () => {
    // Given
    const memory = new WebAssembly.Memory({ initial: 1 })
    let next = 64
    const allocate = vi.fn((size: bigint, alignment: number) => {
      next = Math.ceil(next / alignment) * alignment
      const pointer = next
      next += Number(size)
      if (memory.buffer.byteLength < next)
        memory.grow(Math.ceil((next - memory.buffer.byteLength) / 65_536))
      return pointer
    })
    const free = vi.fn()
    const drop = vi.fn()
    const main = vi.fn((descriptorPointer: number) => {
      const descriptor = new DataView(memory.buffer, descriptorPointer, 56)
      expect(descriptor.getUint32(0, true)).toBe(2)
      expect(descriptor.getUint32(4, true)).toBe(1)
      expect(descriptor.getUint32(8, true)).toBe(1)
      expect(descriptor.getUint32(12, true)).toBe(1)
      expect(descriptor.getUint32(20, true)).toBe(1)
      expect(descriptor.getBigUint64(32, true)).toBe(70_000n)
      expect(descriptor.getBigUint64(40, true)).toBe(70_000n)
      expect(descriptor.getBigInt64(48, true)).toBe(1n)
      new Uint8Array(memory.buffer, descriptor.getUint32(24, true), 70_000).fill(42)
    })
    const module = await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
    const instantiate = vi.spyOn(WebAssembly, "instantiate").mockResolvedValue({
      exports: {
        memory,
        "main!": main,
        __sjulia_alloc: allocate,
        __sjulia_free: free,
        __sjulia_drop: drop,
        __sjulia_wasm_abi_version: () => 2,
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
    expect(allocate).toHaveBeenCalledWith(70_000n, 1)
    expect(allocate).toHaveBeenCalledWith(56n, 8)
    expect(result.data).toEqual(new Uint8ClampedArray(70_000).fill(42))
    expect(result.data.buffer).not.toBe(memory.buffer)
    expect(drop).toHaveBeenCalledTimes(1)
    expect(free).toHaveBeenCalledTimes(1)
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
        __sjulia_alloc: (size: bigint) => (size === 4n ? 64 : 72),
        __sjulia_free: () => undefined,
        __sjulia_drop: () => undefined,
        __sjulia_wasm_abi_version: () => 2,
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
