import { expect, test } from "@playwright/test"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

test("renders a native canvas without pixelated upscaling", async ({ page }) => {
  // Given
  await page.goto("/")
  await expect(page.getByText("loading runtime")).toBeHidden({ timeout: 30_000 })
  await page.getByRole("textbox", { name: "Sokaris code" }).fill(`image = load("pixel.png")
save("output.png", image)`)
  await page.locator('input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: PNG,
  })

  const canvas = page.locator("canvas")

  // Then
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  await expect(canvas).toHaveAttribute("width", "1")
  await expect(canvas).toHaveAttribute("height", "1")
  await expect(canvas).toHaveCSS("image-rendering", "auto")
  const box = await canvas.boundingBox()
  expect(box?.width).toBe(1)
  expect(box?.height).toBe(1)
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
  await expect(editor).toHaveValue(/\n▷save\("output.png", result\)$/)
})
