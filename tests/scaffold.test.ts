import { screen } from "@testing-library/dom"
import { afterEach, describe, expect, it } from "vitest"

describe("test scaffold", () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("queries the jsdom document with Testing Library", () => {
    // Given
    const fixture = document.createElement("main")
    fixture.setAttribute("aria-label", "scaffold fixture")
    document.body.append(fixture)

    // When
    const result = screen.getByRole("main", { name: "scaffold fixture" })

    // Then
    expect(result).toBeInTheDocument()
  })
})
