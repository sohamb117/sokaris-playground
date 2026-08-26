import { COLOR_OPERATIONS } from "./image-color-operations.ts"
import { EFFECT_OPERATIONS } from "./image-effect-operations.ts"
import { FILTER_OPERATIONS } from "./image-filter-operations.ts"
import { GEOMETRY_OPERATIONS } from "./image-geometry-operations.ts"
import type { ImageOperation, ImageOperationRequest } from "./image-operation-types.ts"
import { textOverlay } from "./image-text-operation.ts"
import type { BrowserImageSource } from "./types.ts"

const OPERATIONS: Readonly<Record<string, ImageOperation>> = {
  ...COLOR_OPERATIONS,
  ...FILTER_OPERATIONS,
  ...GEOMETRY_OPERATIONS,
  ...EFFECT_OPERATIONS,
  text_overlay: textOverlay,
}

export const IMAGE_OPERATION_NAMES = Object.freeze(Object.keys(OPERATIONS).sort())

export const applyImageOperation = (request: ImageOperationRequest): BrowserImageSource => {
  const operation = OPERATIONS[request.name]
  if (operation === undefined) throw new TypeError(`Unsupported image operation: ${request.name}`)
  return operation(request)
}
