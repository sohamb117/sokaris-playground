import type { RuntimeWorkerLike } from "./protocol.ts"

export type WorkerSession = {
  readonly generation: number
  readonly worker: RuntimeWorkerLike
  readonly messageListener: (event: MessageEvent<unknown>) => void
  readonly errorListener: (event: ErrorEvent) => void
  readonly messageErrorListener: (event: MessageEvent<unknown>) => void
}

type WorkerSessionCallbacks = {
  readonly onMessage: (raw: unknown) => void
  readonly onError: (event: ErrorEvent) => void
  readonly onMessageError: () => void
}

export const createWorkerSession = (
  worker: RuntimeWorkerLike,
  generation: number,
  callbacks: WorkerSessionCallbacks,
): WorkerSession => {
  const messageListener = (event: MessageEvent<unknown>): void => callbacks.onMessage(event.data)
  const errorListener = (event: ErrorEvent): void => callbacks.onError(event)
  const messageErrorListener = (): void => callbacks.onMessageError()
  worker.addEventListener("message", messageListener)
  worker.addEventListener("error", errorListener)
  worker.addEventListener("messageerror", messageErrorListener)
  return { generation, worker, messageListener, errorListener, messageErrorListener }
}

export const retireWorkerSession = (session: WorkerSession): void => {
  session.worker.removeEventListener("message", session.messageListener)
  session.worker.removeEventListener("error", session.errorListener)
  session.worker.removeEventListener("messageerror", session.messageErrorListener)
  session.worker.terminate()
}
