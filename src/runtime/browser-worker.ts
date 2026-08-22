import type { RuntimeWorkerFactory } from "./protocol.ts"

export const createRuntimeWorker: RuntimeWorkerFactory = () =>
  new Worker(new URL("./compiler-worker.ts", import.meta.url), { type: "module" })
