import { expect, test } from "@playwright/test"

test("opens the compositor menu when Firefox delivers Shift keyup to window", async ({ page }) => {
  // Given
  await page.goto("/")
  const editor = page.getByRole("textbox", { name: "Sokaris code" })
  await editor.focus()

  // When
  await editor.evaluate((textarea) => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", bubbles: true }),
    )
    window.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Shift", code: "ShiftLeft", bubbles: true }),
    )
  })

  // Then
  await expect(page.getByRole("menu")).toBeVisible()
  await expect(page.getByRole("menuitem")).toHaveCount(14)
})
