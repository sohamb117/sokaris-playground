import { describe, expect, it, vi } from "vitest"

import {
  RUNTIME_INITIALIZATION_TIMEOUT_MESSAGE,
  RUNTIME_TIMEOUT_MESSAGE,
  RuntimeController,
} from "../src/runtime/controller.ts"
import type { RuntimeWorkerFactory } from "../src/runtime/protocol.ts"
import { createWorkerFactory, type FakeWorker } from "./support/fake-worker.ts"

const readyController = async (
  factory: RuntimeWorkerFactory,
  workers: FakeWorker[],
): Promise<{ readonly controller: RuntimeController; readonly worker: FakeWorker }> => {
  const controller = new RuntimeController(factory)
  const worker = workers[0]
  if (worker === undefined) throw new TypeError("Controller did not create a worker")
  worker.respond({ kind: "ready", version: "0.12.2" })
  await controller.ready
  return { controller, worker }
}

describe("runtime controller", () => {
  it("serializes one run and coalesces pending work to the latest source", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const { controller, worker } = await readyController(factory, workers)

    // When
    const first = controller.run({ source: "result = 1", images: [] })
    const superseded = controller.run({ source: "result = 2", images: [] })
    const latest = controller.run({ source: "result = 3", images: [] })
    worker.respond({ kind: "result", runId: 1, result: { kind: "scalar", value: 1, output: "" } })
    worker.respond({ kind: "result", runId: 3, result: { kind: "scalar", value: 3, output: "" } })

    // Then
    await expect(first).resolves.toEqual({ kind: "stale" })
    await expect(superseded).resolves.toEqual({ kind: "stale" })
    await expect(latest).resolves.toEqual({ kind: "scalar", value: 3, output: "" })
    expect(worker.posted).toHaveLength(2)
  })

  it("removes its listener and terminates the worker on disposal", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const controller = new RuntimeController(factory)
    const worker = workers[0]

    // When
    controller.dispose()

    // Then
    await expect(controller.ready).rejects.toThrow("Runtime disposed")
    expect(worker?.terminated).toHaveBeenCalledOnce()
  })

  it("settles active and pending runs as stale when disposed", async () => {
    // Given
    vi.useFakeTimers()
    const { factory, workers } = createWorkerFactory()
    const { controller } = await readyController(factory, workers)
    const active = controller.run({ source: "result = runaway()", images: [] })
    const pending = controller.run({ source: "result = 2", images: [] })

    // When
    controller.dispose()
    await vi.runAllTimersAsync()

    // Then
    await expect(active).resolves.toEqual({ kind: "stale" })
    await expect(pending).resolves.toEqual({ kind: "stale" })
    expect(workers).toHaveLength(1)
    vi.useRealTimers()
  })

  it("clones image storage before transfer so the same registry image survives sequential runs", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const { controller, worker } = await readyController(factory, workers)
    const data = new Uint8ClampedArray([0, 64, 128, 255])
    const request = { images: [{ filename: "pixel.png", width: 1, height: 1, data }] }

    // When
    const source = "function main!(pixels::Vector{UInt8})\nend"
    const first = controller.run({ ...request, source })
    worker.respond({
      kind: "result",
      runId: 1,
      result: { kind: "image", width: 1, height: 1, data: new Uint8ClampedArray(data) },
    })
    await first
    const second = controller.run({ ...request, source })
    worker.respond({
      kind: "result",
      runId: 2,
      result: {
        kind: "image",
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 191, 128, 255]),
      },
    })

    // Then
    await expect(second).resolves.toMatchObject({ kind: "image" })
    expect(data.byteLength).toBe(4)
    expect(worker.transfers).toHaveLength(2)
    expect(worker.transfers[0]?.[0]).not.toBe(data.buffer)
    expect(worker.transfers[1]?.[0]).not.toBe(data.buffer)
  })

  it("sends every registered image to the worker in request order", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const { controller, worker } = await readyController(factory, workers)
    const first = new Uint8ClampedArray([1, 1, 1, 255])
    const second = new Uint8ClampedArray([2, 2, 2, 255])

    // When
    const run = controller.run({
      source: "result = 42",
      images: [
        { filename: "inputs/first.png", width: 1, height: 1, data: first },
        { filename: "inputs/second.png", width: 1, height: 1, data: second },
      ],
    })

    // Then
    expect(worker.posted[0]).toMatchObject({
      request: {
        images: [{ filename: "inputs/first.png" }, { filename: "inputs/second.png" }],
      },
    })
    expect(worker.transfers[0]).toHaveLength(2)
    worker.respond({ kind: "result", runId: 1, result: { kind: "scalar", value: 42, output: "" } })
    await expect(run).resolves.toMatchObject({ kind: "scalar", value: 42 })
  })

  it("rejects ready with the initial worker fatal message", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const controller = new RuntimeController(factory)
    const worker = workers[0]

    // When
    worker?.respond({ kind: "fatal", message: "Wasm initialization failed exactly" })

    // Then
    await expect(controller.ready).rejects.toThrow("Wasm initialization failed exactly")
    expect(worker?.terminated).toHaveBeenCalledOnce()
  })

  it("rejects ready and terminates when the worker script emits an error before ready", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const controller = new RuntimeController(factory)
    const worker = workers[0]

    // When
    worker?.fail("Worker script failed to load exactly")

    // Then
    await expect(controller.ready).rejects.toThrow("Worker script failed to load exactly")
    expect(worker?.terminated).toHaveBeenCalledOnce()
  })

  it("uses the worker load fallback when the error message is empty", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const controller = new RuntimeController(factory)

    // When
    workers[0]?.fail()

    // Then
    await expect(controller.ready).rejects.toThrow("Sokaris runtime worker failed to load.")
  })

  it("rejects ready and terminates when the worker emits messageerror before ready", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const controller = new RuntimeController(factory)
    const worker = workers[0]

    // When
    worker?.failMessage()

    // Then
    await expect(controller.ready).rejects.toThrow(
      "Sokaris runtime worker message could not be decoded.",
    )
    expect(worker?.terminated).toHaveBeenCalledOnce()
  })

  it("rejects ready and a queued run when initialization exceeds 60 seconds", async () => {
    // Given
    vi.useFakeTimers()
    const { factory, workers } = createWorkerFactory()
    const controller = new RuntimeController(factory)
    const worker = workers[0]
    const ready = expect(controller.ready).rejects.toThrow(RUNTIME_INITIALIZATION_TIMEOUT_MESSAGE)
    const pending = controller.run({ source: "result = 42", images: [] })

    // When
    await vi.advanceTimersByTimeAsync(60_000)

    // Then
    await ready
    await expect(pending).resolves.toEqual({
      kind: "error",
      message: RUNTIME_INITIALIZATION_TIMEOUT_MESSAGE,
      output: "",
    })
    expect(worker?.terminated).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("restarts after a ready worker error and runs only the newest pending request after replacement ready", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const { controller, worker } = await readyController(factory, workers)
    const active = controller.run({ source: "result = runaway()", images: [] })
    const superseded = controller.run({ source: "result = 2", images: [] })
    const latest = controller.run({ source: "result = 777", images: [] })

    // When
    worker.fail("Worker crashed after ready")
    const replacement = workers[1]

    // Then
    await expect(active).resolves.toEqual({
      kind: "error",
      message: "Worker crashed after ready",
      output: "",
    })
    await expect(superseded).resolves.toEqual({ kind: "stale" })
    expect(worker.terminated).toHaveBeenCalledOnce()
    expect(replacement?.posted).toHaveLength(0)

    // When
    replacement?.respond({ kind: "ready", version: "0.12.2" })
    replacement?.respond({
      kind: "result",
      runId: 3,
      result: { kind: "scalar", value: 777, output: "" },
    })

    // Then
    expect(replacement?.posted).toMatchObject([
      { kind: "run", runId: 3, request: { source: "result = 777" } },
    ])
    await expect(latest).resolves.toEqual({ kind: "scalar", value: 777, output: "" })
  })

  it("stops after a recovery worker initialization deadline and settles pending work", async () => {
    // Given
    vi.useFakeTimers()
    const { factory, workers } = createWorkerFactory()
    const { controller, worker } = await readyController(factory, workers)
    const active = controller.run({ source: "result = runaway()", images: [] })
    const pending = controller.run({ source: "result = 777", images: [] })
    worker.fail("Worker crashed after ready")
    const replacement = workers[1]

    // When
    await vi.advanceTimersByTimeAsync(60_000)

    // Then
    await expect(active).resolves.toMatchObject({ kind: "error" })
    await expect(pending).resolves.toEqual({
      kind: "error",
      message: RUNTIME_INITIALIZATION_TIMEOUT_MESSAGE,
      output: "",
    })
    expect(replacement?.terminated).toHaveBeenCalledOnce()
    expect(workers).toHaveLength(2)
    controller.dispose()
    vi.useRealTimers()
  })

  it("times out an active run, replaces its worker, and runs the latest request after ready", async () => {
    // Given
    vi.useFakeTimers()
    const { factory, workers } = createWorkerFactory()
    const { controller, worker: firstWorker } = await readyController(factory, workers)
    const runaway = controller.run({ source: "result = runaway()", images: [] })
    const superseded = controller.run({ source: "result = 2", images: [] })
    const latest = controller.run({ source: "result = 777", images: [] })

    // When
    await vi.advanceTimersByTimeAsync(10_000)
    const replacement = workers[1]
    replacement?.respond({ kind: "ready", version: "0.12.2" })
    replacement?.respond({
      kind: "result",
      runId: 3,
      result: { kind: "scalar", value: 777, output: "" },
    })

    // Then
    await expect(runaway).resolves.toEqual({
      kind: "error",
      message: RUNTIME_TIMEOUT_MESSAGE,
      output: "",
    })
    expect(firstWorker.terminated).toHaveBeenCalledOnce()
    expect(workers).toHaveLength(2)
    await expect(superseded).resolves.toEqual({ kind: "stale" })
    expect(replacement?.posted).toMatchObject([
      { kind: "run", runId: 3, request: { source: "result = 777" } },
    ])
    await expect(latest).resolves.toEqual({ kind: "scalar", value: 777, output: "" })
    controller.dispose()
    vi.useRealTimers()
  })

  it("completes only an active run-error and immediately starts the pending latest run", async () => {
    // Given
    const { factory, workers } = createWorkerFactory()
    const { controller, worker } = await readyController(factory, workers)
    const active = controller.run({ source: "result = (", images: [] })
    const pending = controller.run({ source: "result = 777", images: [] })

    // When
    worker.respond({ kind: "run-error", runId: 1, message: "parse failed", output: "" })
    worker.respond({
      kind: "result",
      runId: 2,
      result: { kind: "scalar", value: 777, output: "" },
    })

    // Then
    await expect(active).resolves.toEqual({
      kind: "error",
      message: "parse failed",
      output: "",
    })
    expect(worker.posted).toMatchObject([
      { kind: "run", runId: 1 },
      { kind: "run", runId: 2, request: { source: "result = 777" } },
    ])
    await expect(pending).resolves.toEqual({ kind: "scalar", value: 777, output: "" })
  })
})
