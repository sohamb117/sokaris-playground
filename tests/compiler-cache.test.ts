import { describe, expect, it, vi } from "vitest"

import { CompilerModuleCache } from "../src/runtime/compiler-cache.ts"

const emptyModule = (): Promise<WebAssembly.Module> =>
  WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))

describe("compiler module cache", () => {
  it("reuses source and ABI entries and evicts the oldest at capacity", async () => {
    // Given
    const cache = new CompilerModuleCache(2)
    const first = vi.fn(emptyModule)
    const second = vi.fn(emptyModule)
    const third = vi.fn(emptyModule)

    // When
    await cache.get("source-a|abi-1", first)
    await cache.get("source-a|abi-1", first)
    await cache.get("source-b|abi-1", second)
    await cache.get("source-c|abi-1", third)
    await cache.get("source-a|abi-1", first)

    // Then
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledOnce()
    expect(third).toHaveBeenCalledOnce()
  })

  it("shares an in-flight compilation for the same source and ABI", async () => {
    // Given
    const cache = new CompilerModuleCache(2)
    const compile = vi.fn(emptyModule)

    // When
    const [first, second] = await Promise.all([
      cache.get("source-a|abi-1", compile),
      cache.get("source-a|abi-1", compile),
    ])

    // Then
    expect(first).toBe(second)
    expect(compile).toHaveBeenCalledOnce()
  })
})
