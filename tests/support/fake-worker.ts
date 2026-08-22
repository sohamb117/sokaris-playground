import { vi } from "vitest"

import type {
  RuntimeWorkerFactory,
  RuntimeWorkerLike,
  WorkerResponse,
} from "../../src/runtime/protocol.ts"

type MessageListener = (event: MessageEvent<unknown>) => void
type ErrorListener = (event: ErrorEvent) => void
type WorkerListenerArguments =
  | readonly [type: "message", listener: MessageListener]
  | readonly [type: "error", listener: ErrorListener]
  | readonly [type: "messageerror", listener: MessageListener]

export class FakeWorker implements RuntimeWorkerLike {
  readonly posted: unknown[] = []
  readonly transfers: Transferable[][] = []
  readonly terminated = vi.fn()
  private messageListener: MessageListener | undefined
  private errorListener: ErrorListener | undefined
  private messageErrorListener: MessageListener | undefined

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.posted.push(message)
    this.transfers.push(transfer)
  }

  addEventListener(...[type, listener]: WorkerListenerArguments): void {
    switch (type) {
      case "message":
        this.messageListener = listener
        return
      case "error":
        this.errorListener = listener
        return
      case "messageerror":
        this.messageErrorListener = listener
        return
    }
  }

  removeEventListener(...[type, listener]: WorkerListenerArguments): void {
    switch (type) {
      case "message":
        if (this.messageListener === listener) this.messageListener = undefined
        return
      case "error":
        if (this.errorListener === listener) this.errorListener = undefined
        return
      case "messageerror":
        if (this.messageErrorListener === listener) this.messageErrorListener = undefined
        return
    }
  }

  terminate(): void {
    this.terminated()
  }

  respond(response: WorkerResponse): void {
    this.messageListener?.(new MessageEvent("message", { data: response }))
  }

  fail(message = ""): void {
    this.errorListener?.(new ErrorEvent("error", { message }))
  }

  failMessage(): void {
    this.messageErrorListener?.(new MessageEvent("messageerror"))
  }
}

export const createWorkerFactory = (): {
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
