import { expect, type Page, test } from "@playwright/test"

const waitForReady = async (page: Page): Promise<void> => {
  await expect(page.getByText("loading runtime")).toBeHidden({ timeout: 30_000 })
}

async function createVisiblePng(page: Page): Promise<Buffer<ArrayBuffer>> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 1
    const context = canvas.getContext("2d")
    if (context === null) return ""
    context.fillStyle = "#f00"
    context.fillRect(0, 0, 1, 1)
    context.fillStyle = "#00f"
    context.fillRect(1, 0, 1, 1)
    return canvas.toDataURL("image/png").split(",")[1] ?? ""
  })
  return Buffer.from(base64, "base64")
}

test("previews clickable top-level load and save artifacts without rerunning", async ({ page }) => {
  // Given
  await page.goto("/")
  await waitForReady(page)
  await page.locator('input[type="file"]').setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: await createVisiblePng(page),
  })
  const editor = page.getByRole("textbox", { name: "Sokaris code" })
  const source = `image = load("source.png")
save("results/first.png", image)
save("results/last.png", image)`

  // When
  await editor.fill(source)

  // Then
  const first = page.getByRole("button", { name: "Output results/first.png" })
  const last = page.getByRole("button", { name: "Output results/last.png" })
  await expect(first).toHaveText("first.png", { timeout: 30_000 })
  await expect(last).toHaveText("last.png")
  await expect(last).toHaveAttribute("aria-pressed", "true")
  await page.locator("[data-output-pane]").evaluate((outputPane) => {
    Reflect.set(window, "artifactPreviewBusyTransitions", 0)
    new MutationObserver(() => {
      if (outputPane.getAttribute("aria-busy") === "true") {
        const transitions = Reflect.get(window, "artifactPreviewBusyTransitions")
        if (typeof transitions === "number") {
          Reflect.set(window, "artifactPreviewBusyTransitions", transitions + 1)
        }
      }
    }).observe(outputPane, { attributes: true, attributeFilter: ["aria-busy"] })
  })

  // When
  await first.press("Enter")

  // Then
  await expect(first).toHaveAttribute("aria-pressed", "true")
  await expect(last).toHaveAttribute("aria-pressed", "false")

  // When
  await page.getByRole("button", { name: "Input source.png" }).click()

  // Then
  await expect(first).toHaveAttribute("aria-pressed", "false")
  await expect(page.getByRole("button", { name: "Input source.png" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "artifactPreviewBusyTransitions")))
    .toBe(0)
  await expect(page.locator("canvas")).toHaveAttribute("width", "2")
  await expect(page.locator("canvas")).toHaveAttribute("height", "1")
})
