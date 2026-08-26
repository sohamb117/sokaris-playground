import { describe, expect, it } from "vitest"

import {
  parseWorkerResponse,
  prepareRuntimeResultTransfer,
  runtimeResultTransfers,
} from "../src/runtime/protocol.ts"

describe("runtime artifact protocol", () => {
  it("parses ordered image artifacts and transfers every pixel buffer", () => {
    const first = new Uint8ClampedArray([1, 2, 3, 4])
    const second = new Uint8ClampedArray([5, 6, 7, 8])

    const response = parseWorkerResponse({
      kind: "result",
      runId: 7,
      result: {
        kind: "artifacts",
        artifacts: [
          { filename: "first.png", width: 1, height: 1, data: first },
          { filename: "second.png", width: 1, height: 1, data: second },
        ],
      },
    })

    expect(response).toEqual({
      kind: "result",
      runId: 7,
      result: {
        kind: "artifacts",
        artifacts: [
          { filename: "first.png", width: 1, height: 1, data: first },
          { filename: "second.png", width: 1, height: 1, data: second },
        ],
      },
    })
    if (response.kind !== "result") throw new TypeError("Expected result response")
    expect(runtimeResultTransfers(response.result)).toEqual([first.buffer, second.buffer])
  })

  it("rejects artifacts whose dimensions do not match RGBA storage", () => {
    const parse = () =>
      parseWorkerResponse({
        kind: "result",
        runId: 1,
        result: {
          kind: "artifacts",
          artifacts: [
            {
              filename: "broken.png",
              width: 2,
              height: 1,
              data: new Uint8ClampedArray([1, 2, 3, 4]),
            },
          ],
        },
      })

    expect(parse).toThrow("Invalid runtime artifact")
  })

  it("copies result buffers before transfer so worker-owned artifacts remain attached", () => {
    const original = new Uint8ClampedArray([1, 2, 3, 4])

    const prepared = prepareRuntimeResultTransfer({
      kind: "artifacts",
      artifacts: [{ filename: "output.png", width: 1, height: 1, data: original }],
    })

    expect(prepared.transfer).toHaveLength(1)
    expect(prepared.transfer[0]).not.toBe(original.buffer)
    expect(original.byteLength).toBe(4)
    expect(prepared.result).toEqual({
      kind: "artifacts",
      artifacts: [{ filename: "output.png", width: 1, height: 1, data: original }],
    })
  })
})
