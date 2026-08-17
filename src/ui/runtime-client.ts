import { createRuntimeWorker } from "../runtime/browser-worker.ts"
import { RuntimeController } from "../runtime/controller.ts"
import type { RuntimeRequest, RuntimeResult } from "../runtime/types.ts"

export type RuntimeClient = {
  readonly ready: Promise<void>
  readonly run: (request: RuntimeRequest) => Promise<RuntimeResult>
  readonly dispose: () => void
}

export const createRuntimeClient = (): RuntimeClient => {
  const controller = new RuntimeController(createRuntimeWorker)
  return {
    ready: controller.ready,
    run: (request) => controller.run(request),
    dispose: () => controller.dispose(),
  }
}
