import { afterEach, describe, expect, it } from "vitest"
import { OperatorMenu } from "../src/ui/operator-menu.ts"

const pressShift = (): void => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }))
  window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }))
}

describe("OperatorMenu", () => {
  afterEach(() => document.body.replaceChildren())

  it("opens only from a focused textarea and stops handling after disposal", () => {
    // Given
    const textarea = document.createElement("textarea")
    document.body.append(textarea)
    const menu = new OperatorMenu({ textarea, onInsert: () => undefined })

    // When
    pressShift()

    // Then
    expect(document.querySelector('[role="menu"]')).toBeNull()

    // When
    textarea.focus()
    pressShift()

    // Then
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(14)

    // When
    menu.dispose()
    textarea.focus()
    pressShift()

    // Then
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })
})
