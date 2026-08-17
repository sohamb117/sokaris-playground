import { RuntimeContractError, RuntimeLifecycleError } from "./errors.ts"
import { validateRuntimeSource } from "./julia-source.ts"
import {
  parseWorkerResponse,
  type RuntimeWorkerFactory,
  type RuntimeWorkerLike,
  type WorkerResponse,
} from "./protocol.ts"
import type { RuntimeRequest, RuntimeResult } from "./types.ts"

export const RUNTIME_TIMEOUT_MESSAGE = "Sokaris execution timed out after 10 seconds."
const RUNTIME_TIMEOUT_MS = 10_000

type PendingRun = {
  readonly runId: number
  readonly request: RuntimeRequest
  readonly resolve: (result: RuntimeResult) => void
}

type WorkerSession = {
  readonly generation: number
  readonly worker: RuntimeWorkerLike
  readonly listener: (event: MessageEvent<unknown>) => void
}

const errorResult = (message: string): RuntimeResult => ({ kind: "error", message, output: "" })

export class RuntimeController {
  readonly ready: Promise<void>
  private nextRunId = 1
  private nextGeneration = 1
  private active: PendingRun | undefined
  private pending: PendingRun | undefined
  private session: WorkerSession | undefined
  private watchdog: ReturnType<typeof setTimeout> | undefined
  private resolveReady: () => void = () => undefined
  private rejectReady: (error: RuntimeLifecycleError) => void = () => undefined
  private readySettled = false
  private hasBeenReady = false
  private workerReady = false
  private recovering = false
  private disposed = false
  private unavailableMessage: string | undefined

  constructor(private readonly createWorker: RuntimeWorkerFactory) {
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    this.spawnWorker()
  }

  run(request: RuntimeRequest): Promise<RuntimeResult> {
    if (this.disposed) return Promise.resolve(errorResult("Runtime disposed"))
    if (this.unavailableMessage !== undefined) {
      return Promise.resolve(errorResult(this.unavailableMessage))
    }
    try {
      validateRuntimeSource(request.source)
    } catch (error) {
      if (error instanceof RuntimeContractError) return Promise.resolve(errorResult(error.message))
      throw error
    }
    return new Promise((resolve) => {
      const run = { runId: this.nextRunId, request, resolve }
      this.nextRunId += 1
      if (this.active === undefined && this.workerReady) {
        this.start(run)
        return
      }
      this.pending?.resolve({ kind: "stale" })
      this.pending = run
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clearWatchdog()
    this.active?.resolve({ kind: "stale" })
    this.pending?.resolve({ kind: "stale" })
    this.active = undefined
    this.pending = undefined
    if (!this.readySettled) this.settleReadyFailure("Runtime disposed")
    this.retireWorker()
  }

  private spawnWorker(): void {
    try {
      const worker = this.createWorker()
      const generation = this.nextGeneration
      this.nextGeneration += 1
      const listener = (event: MessageEvent<unknown>): void => {
        if (this.session?.generation === generation) this.handleMessage(event.data)
      }
      this.session = { generation, worker, listener }
      this.workerReady = false
      worker.addEventListener("message", listener)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime worker creation failed"
      this.stopAfterFailure(message)
    }
  }

  private start(run: PendingRun): void {
    const session = this.session
    if (session === undefined || !this.workerReady) {
      this.pending?.resolve({ kind: "stale" })
      this.pending = run
      return
    }
    this.active = run
    const images = run.request.images.map((image) => ({
      ...image,
      data: new Float64Array(image.data),
    }))
    const transfer = images.map((image) => image.data.buffer)
    session.worker.postMessage(
      { kind: "run", runId: run.runId, request: { ...run.request, images } },
      transfer,
    )
    const generation = session.generation
    this.watchdog = setTimeout(() => this.handleTimeout(run.runId, generation), RUNTIME_TIMEOUT_MS)
  }

  private handleMessage(raw: unknown): void {
    let response: WorkerResponse
    try {
      response = parseWorkerResponse(raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid runtime worker response"
      this.handleFatal(message)
      return
    }
    switch (response.kind) {
      case "ready":
        this.handleReady()
        return
      case "result":
        this.handleResult(response.runId, response.result)
        return
      case "run-error":
        this.handleRunError(response.runId, response.message, response.output)
        return
      case "fatal":
        this.handleFatal(response.message)
        return
    }
  }

  private handleReady(): void {
    this.workerReady = true
    this.recovering = false
    if (!this.hasBeenReady) {
      this.hasBeenReady = true
      this.readySettled = true
      this.resolveReady()
    }
    this.startPending()
  }

  private handleResult(runId: number, result: RuntimeResult): void {
    if (this.active?.runId !== runId) return
    const completed = this.active
    this.active = undefined
    this.clearWatchdog()
    if (this.pending === undefined) completed.resolve(result)
    else completed.resolve({ kind: "stale" })
    this.startPending()
  }

  private handleRunError(runId: number, message: string, output: string): void {
    if (this.active?.runId !== runId) return
    const completed = this.active
    this.active = undefined
    this.clearWatchdog()
    completed.resolve({ kind: "error", message, output })
    this.startPending()
  }

  private handleTimeout(runId: number, generation: number): void {
    if (this.active?.runId !== runId || this.session?.generation !== generation) return
    this.restartWorker(RUNTIME_TIMEOUT_MESSAGE)
  }

  private handleFatal(message: string): void {
    if (!this.hasBeenReady) {
      this.stopAfterFailure(message)
      return
    }
    if (this.recovering && !this.workerReady) {
      this.stopAfterFailure(message)
      return
    }
    this.restartWorker(message)
  }

  private restartWorker(message: string): void {
    this.clearWatchdog()
    this.active?.resolve(errorResult(message))
    this.active = undefined
    this.retireWorker()
    this.recovering = true
    this.spawnWorker()
  }

  private stopAfterFailure(message: string): void {
    this.clearWatchdog()
    this.active?.resolve(errorResult(message))
    this.pending?.resolve(errorResult(message))
    this.active = undefined
    this.pending = undefined
    this.unavailableMessage = message
    this.retireWorker()
    if (!this.readySettled) this.settleReadyFailure(message)
  }

  private settleReadyFailure(message: string): void {
    this.readySettled = true
    this.rejectReady(new RuntimeLifecycleError(message))
  }

  private startPending(): void {
    if (!this.workerReady || this.active !== undefined || this.pending === undefined) return
    const latest = this.pending
    this.pending = undefined
    this.start(latest)
  }

  private clearWatchdog(): void {
    if (this.watchdog === undefined) return
    clearTimeout(this.watchdog)
    this.watchdog = undefined
  }

  private retireWorker(): void {
    const session = this.session
    if (session === undefined) return
    this.session = undefined
    this.workerReady = false
    session.worker.removeEventListener("message", session.listener)
    session.worker.terminate()
  }
}
