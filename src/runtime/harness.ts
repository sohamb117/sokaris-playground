import { createRuntimeWorker } from "./browser-worker.ts"
import { RuntimeController } from "./controller.ts"

const toSerializableResult = async (
  controller: RuntimeController,
  source: string,
  images: readonly HarnessImage[],
): Promise<HarnessResult> => {
  const result = await controller.run({
    source,
    images: images.map((image) => ({
      filename: image.filename,
      width: image.width,
      height: image.height,
      data: new Uint8ClampedArray(image.data),
    })),
  })
  switch (result.kind) {
    case "scalar":
      return result
    case "image":
      return {
        kind: "image",
        width: result.width,
        height: result.height,
        data: Array.from(result.data),
      }
    case "error":
      return result
    case "stale":
      return { kind: "error", message: "Runtime result was superseded", output: "" }
  }
}

export const installRuntimeHarness = (): void => {
  const controller = new RuntimeController(createRuntimeWorker)
  window.__sokarisRuntime = {
    ready: false,
    run: (source, images) => toSerializableResult(controller, source, images),
  }
  void controller.ready.then(
    () => {
      const harness = window.__sokarisRuntime
      if (harness !== undefined) window.__sokarisRuntime = { ...harness, ready: true }
    },
    () => undefined,
  )
  window.addEventListener("pagehide", () => controller.dispose(), { once: true })
}
