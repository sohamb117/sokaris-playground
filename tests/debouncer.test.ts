import { describe, expect, it, vi } from "vitest"

import { Debouncer } from "../src/ui/debouncer.ts"

describe("debouncer", () => {
  it("runs only the latest scheduled action after 300ms", () => {
    // Given
    vi.useFakeTimers()
    const calls: string[] = []
    const debouncer = new Debouncer(300)

    // When
    debouncer.schedule(() => calls.push("first"))
    vi.advanceTimersByTime(150)
    debouncer.schedule(() => calls.push("latest"))
    vi.advanceTimersByTime(299)

    // Then
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual(["latest"])
    debouncer.dispose()
    vi.useRealTimers()
  })
})
