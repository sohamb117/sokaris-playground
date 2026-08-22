import { expect, test } from "@playwright/test"

const TIMEOUT_MESSAGE = "Sokaris execution timed out after 10 seconds."

test("times out a runaway run and succeeds with the next valid source without reload", async ({
  page,
}) => {
  // Given
  await page.goto("/")
  const editor = page.getByRole("textbox", { name: "Sokaris code" })
  const scalar = page.locator("[data-scalar-result]")
  const output = page.locator("[data-output-pane]")
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 })

  // When
  await editor.fill("result = ✧(1:400000000, (a,b)->a+b)")

  // Then
  await expect(page.getByText("running", { exact: true })).toBeVisible()
  await expect(output).toHaveAttribute("aria-busy", "true")
  await expect(scalar).toBeHidden()
  await expect(page.getByRole("alert")).toHaveText(TIMEOUT_MESSAGE, { timeout: 15_000 })
  await expect(page.getByText("running", { exact: true })).toBeHidden()
  await expect(output).not.toHaveAttribute("aria-busy")
  await expect(scalar).toBeHidden()

  // When
  await editor.fill("result = 7 * 111")

  // Then
  await expect(scalar).toHaveText("777", { timeout: 30_000 })
  await expect(scalar).toBeVisible()
  await expect(page.getByRole("alert")).toBeHidden()
})

test("shows an initialization alert and hides loading when the local Wasm request fails", async ({
  page,
}) => {
  // Given
  await page.route("**/*subset_julia_vm_web_bg*.wasm", (route) =>
    route.fulfill({ status: 500, contentType: "application/wasm", body: "failed" }),
  )

  // When
  await page.goto("/")

  // Then
  await expect(page.getByText("loading runtime", { exact: true })).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.getByRole("alert")).not.toBeEmpty()
})

test("shows an initialization alert and hides loading when the worker script fails to load", async ({
  page,
}) => {
  // Given
  await page.route("**/assets/compiler-worker-*.js", (route) => route.abort("failed"))

  // When
  await page.goto("/")

  // Then
  await expect(page.getByText("loading runtime", { exact: true })).toBeHidden({ timeout: 5_000 })
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.getByRole("alert")).not.toBeEmpty()
})
