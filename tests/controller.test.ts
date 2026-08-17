import { describe, expect, it, vi } from "vitest"

import { RUNTIME_TIMEOUT_MESSAGE, RuntimeController } from "../src/runtime/controller.ts"
import type {
  RuntimeWorkerFactory,
  RuntimeWorkerLike,
  WorkerResponse,
} from "../src/runtime/protocol.ts"

class FakeWorker implements RuntimeWorkerLike {
  readonly posted: unknown[] = []
  readonly transfers: Transferable[][] = []
  readonly terminated = vi.fn()
  private listener: ((event: MessageEvent<unknown>) => void) | undefined

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.posted.push(message)
    this.transfers.push(transfer)
  }

  addEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listener = listener
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    if (this.listener === listener) this.listener = undefined
  }

  terminate(): void {
    this.terminated()
  }

  respond(response: WorkerResponse): void {
    this.listener?.(new MessageEvent("message", { data: response }))
  }
}

const createWorkerFactory = (): {
  readonly factory: RuntimeWorkerFactory
  readonly workers: FakeWorker[]
} => {
  const workers: FakeWorker[] = []
  return {
    workers,
    factory: () => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    },
  }
}

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
    const data = new Float64Array([0, 0.25, 0.5, 1])
    const request = { images: [{ filename: "pixel.png", width: 1, height: 1, data }] }

    // When
    const first = controller.run({ ...request, source: 'result = load("pixel.png")' })
    worker.respond({
      kind: "result",
      runId: 1,
      result: { kind: "image", width: 1, height: 1, data: new Float64Array(data) },
    })
    await first
    const second = controller.run({ ...request, source: 'result = load("pixel.png") ▷ invert' })
    worker.respond({
      kind: "result",
      runId: 2,
      result: { kind: "image", width: 1, height: 1, data: new Float64Array([1, 0.75, 0.5, 1]) },
    })

    // Then
    await expect(second).resolves.toMatchObject({ kind: "image" })
    expect(data.byteLength).toBe(32)
    expect(worker.transfers).toHaveLength(2)
    expect(worker.transfers[0]?.[0]).not.toBe(data.buffer)
    expect(worker.transfers[1]?.[0]).not.toBe(data.buffer)
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
