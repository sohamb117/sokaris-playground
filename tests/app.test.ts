import { fireEvent, getByRole, queryByRole, waitFor } from "@testing-library/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runtime = vi.hoisted(() => ({
  run: vi.fn(),
  dispose: vi.fn(),
}))
const painter = vi.hoisted(() => ({ paintImage: vi.fn() }))

vi.mock("../src/examples/load-starter-image.ts", () => ({
  loadStarterImage: () =>
    Promise.resolve({
      filename: "input.png",
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([1, 2, 3, 255]),
    }),
}))

vi.mock("../src/ui/runtime-client.ts", () => ({
  createRuntimeClient: () => ({
    ready: Promise.resolve(),
    run: runtime.run,
    dispose: runtime.dispose,
  }),
}))

vi.mock("../src/ui/canvas-painter.ts", () => painter)

import { mountSokarisApp, type SokarisApp } from "../src/ui/app.ts"

const artifactResult = {
  kind: "artifacts" as const,
  artifacts: [
    {
      filename: "results/first.png",
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([10, 20, 30, 255]),
    },
    {
      filename: "results/last.png",
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([40, 50, 60, 255]),
    },
  ],
}

describe("artifact app behavior", () => {
  let app: SokarisApp | undefined
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement("div")
    painter.paintImage.mockReset()
    runtime.run.mockReset()
    runtime.run.mockResolvedValue(artifactResult)
  })

  afterEach(() => app?.dispose())

  it("replaces output rows and selects the last successful artifact", async () => {
    // Given / When
    app = mountSokarisApp(root)

    // Then
    const last = await waitFor(() => getByRole(root, "button", { name: "Output results/last.png" }))
    expect(getByRole(root, "button", { name: "Output results/first.png" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(last).toHaveAttribute("aria-pressed", "true")
    expect(painter.paintImage).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      artifactResult.artifacts[1],
    )
  })

  it("retains output rows, selection, and canvas after a runtime error", async () => {
    // Given
    app = mountSokarisApp(root)
    const output = await waitFor(() =>
      getByRole(root, "button", { name: "Output results/last.png" }),
    )
    const paints = painter.paintImage.mock.calls.length
    runtime.run.mockResolvedValueOnce({ kind: "error", message: "runtime failed", output: "" })

    // When
    fireEvent.input(getByRole(root, "textbox", { name: "Sokaris code" }))
    await waitFor(
      () => expect(root.querySelector('[role="alert"]')).toHaveTextContent("runtime failed"),
      { timeout: 1_000 },
    )

    // Then
    expect(output).toHaveAttribute("aria-pressed", "true")
    expect(queryByRole(root, "button", { name: "Output results/first.png" })).not.toBeNull()
    expect(painter.paintImage).toHaveBeenCalledTimes(paints)
  })

  it("previews a selected input without executing the runtime", async () => {
    // Given
    app = mountSokarisApp(root)
    await waitFor(() => getByRole(root, "button", { name: "Output results/last.png" }))
    const calls = runtime.run.mock.calls.length

    // When
    fireEvent.click(getByRole(root, "button", { name: "Input input.png" }))

    // Then
    expect(runtime.run).toHaveBeenCalledTimes(calls)
    expect(getByRole(root, "button", { name: "Input input.png" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(painter.paintImage).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), {
      filename: "input.png",
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([1, 2, 3, 255]),
    })
  })
})
