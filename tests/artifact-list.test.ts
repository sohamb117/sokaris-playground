import { fireEvent, getByRole } from "@testing-library/dom"
import { describe, expect, it, vi } from "vitest"

import { renderArtifactList } from "../src/ui/artifact-list.ts"

const image = (filename: string, value: number) => ({
  filename,
  width: 1,
  height: 1,
  data: new Uint8ClampedArray([value, value, value, 255]),
})

describe("artifact list", () => {
  it("renders native full-width rows with provenance and basename labels", () => {
    // Given
    const list = document.createElement("ul")

    // When
    renderArtifactList(list, {
      provenance: "output",
      images: [image("results/final.png", 255)],
      selectedPath: "results/final.png",
      onSelect: vi.fn(),
    })

    // Then
    const button = getByRole(list, "button", { name: "Output results/final.png" })
    expect(button).toHaveTextContent("final.png")
    expect(button).toHaveAttribute("type", "button")
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button.parentElement).toHaveRole("listitem")
  })

  it("activates an input row through native keyboard behavior", () => {
    // Given
    const list = document.createElement("ul")
    const onSelect = vi.fn()
    renderArtifactList(list, {
      provenance: "input",
      images: [image("nested/source.png", 64)],
      selectedPath: undefined,
      onSelect,
    })

    // When
    fireEvent.click(getByRole(list, "button", { name: "Input nested/source.png" }))

    // Then
    expect(onSelect).toHaveBeenCalledWith("nested/source.png")
  })
})
