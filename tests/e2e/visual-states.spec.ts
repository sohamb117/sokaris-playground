import { expect, test } from "@playwright/test"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

test("renders a scaled VM canvas with crisp pixels and intrinsic dimensions", async ({ page }) => {
  // Given
  await page.goto("/")
  await expect(page.getByText("loading runtime")).toBeHidden({ timeout: 30_000 })
  await page.locator('input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: PNG,
  })

  // When
  await page.getByRole("textbox", { name: "Sokaris code" }).fill('result = load("pixel.png")')
  const canvas = page.locator("canvas")

  // Then
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  await expect(canvas).toHaveAttribute("width", "1")
  await expect(canvas).toHaveAttribute("height", "1")
  await expect(canvas).toHaveCSS("image-rendering", "pixelated")
  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(1)
  expect(box?.height ?? 0).toBeGreaterThan(1)
})

test("keeps keyboard focus visually unique when another operator is hovered", async ({ page }) => {
  // Given
  await page.goto("/")
  const editor = page.getByRole("textbox", { name: "Sokaris code" })
  await editor.focus()
  await editor.press("Home")
  await page.keyboard.press("Shift")
  const items = page.getByRole("menuitem")
  await expect(items.first()).toBeFocused()

  // When
  await items.nth(1).hover()

  // Then
  const states = await items.evaluateAll((buttons) =>
    buttons.map((button) => ({
      background: getComputedStyle(button).backgroundColor,
      color: getComputedStyle(button).color,
      focused: button === document.activeElement,
    })),
  )
  expect(states.filter(({ background }) => background === "rgb(255, 255, 255)")).toHaveLength(1)
  expect(states[0]).toEqual({
    background: "rgb(255, 255, 255)",
    color: "rgb(0, 0, 0)",
    focused: true,
  })
  expect(states[1]).toEqual({
    background: "rgb(0, 0, 0)",
    color: "rgb(255, 255, 255)",
    focused: false,
  })
  await page.getByRole("main").screenshot({ path: "test-results/evidence/menu-hover-focus.png" })
  await page.keyboard.press("Enter")
  await expect(editor).toHaveValue("▷result = 21 ▷ (x -> x * 2)")
})
