import { expect, test } from "@playwright/test"

test("compiled starter renders the bundled image at native dimensions", async ({ page }) => {
  // Given / When
  await page.goto("/")

  // Then
  await expect(page.getByRole("listitem")).toHaveText("input.png")
  await expect(page.getByRole("textbox", { name: "Sokaris code" })).toHaveValue(
    /function main!\(pixels::Vector\{UInt8\}\)/,
  )
  const canvas = page.locator("canvas")
  await expect(canvas).toBeVisible({ timeout: 60_000 })
  await expect(canvas).toHaveAttribute("width", "888")
  await expect(canvas).toHaveAttribute("height", "862")
  const evidence = await canvas.evaluate(async (element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new TypeError("Expected a canvas")
    const context = element.getContext("2d")
    if (context === null) throw new TypeError("Canvas context is unavailable")
    const bytes = context.getImageData(0, 0, element.width, element.height).data
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    const hash = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("")
    const sample = (x: number, y: number): readonly number[] => {
      const offset = (y * element.width + x) * 4
      return Array.from(bytes.slice(offset, offset + 4))
    }
    return {
      hash,
      topLeft: sample(0, 0),
      bottomRight: sample(element.width - 1, element.height - 1),
      center: sample(Math.floor(element.width / 2), Math.floor(element.height / 2)),
    }
  })
  expect(evidence).toEqual({
    hash: "8bc7d74cd9cca224ef3bc8dc14e4ed2980a28270c83e5faf79450d83726bff02",
    topLeft: [127, 127, 127, 255],
    bottomRight: [92, 92, 92, 255],
    center: [232, 232, 232, 255],
  })
})

test("shows the existing alert when the bundled starter image cannot load", async ({ page }) => {
  // Given
  await page.route("**/assets/input-*.png", (route) => route.abort("failed"))

  // When
  await page.goto("/")

  // Then
  await expect(page.getByText("loading runtime", { exact: true })).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.getByRole("alert")).not.toBeEmpty()
})

test("help contains the compiler contract and exact glyph guidance and restores focus", async ({
  page,
}) => {
  // Given
  await page.goto("/")
  const trigger = page.getByRole("button", { name: "Open Sokaris help" })

  // When
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Sokaris compositor help" })

  // Then
  await expect(dialog).toContainText("typed Julia subset, not full Julia")
  await expect(dialog).toContainText("main!(pixels::Vector{UInt8})")
  await expect(dialog).toContainText("native resolution")
  await expect(dialog).toContainText("source diagnostics")
  await expect(dialog).toContainText("⚹ hex neighbors")
  await expect(dialog.getByRole("heading", { name: "Quick start" })).toBeVisible()
  await expect(dialog.locator("pre")).toContainText("function main!(pixels::Vector{UInt8})")
  await expect(dialog.getByRole("heading", { name: "Program rules" })).toBeVisible()
  await expect(dialog).toContainText("most recently inserted or replaced image is active")
  await expect(dialog.getByRole("heading", { name: "Compiler subset" })).toBeVisible()
  await expect(dialog).toContainText("while / if / else")
  await expect(dialog.getByRole("heading", { name: "Runtime limits" })).toBeVisible()
  await expect(dialog).toContainText("10 seconds")
  await expect(dialog.locator("[data-glyph-help]")).toHaveCount(14)
  const scrollMetrics = await dialog.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }))
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
  expect(scrollMetrics.overflowY).toBe("auto")
  await dialog.evaluate((element) => element.scrollTo(0, element.scrollHeight))
  await expect(dialog).toContainText("60 seconds")
  await page.getByRole("main").screenshot({ path: "test-results/evidence/help.png" })
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
