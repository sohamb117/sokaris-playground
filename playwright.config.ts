import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chrome",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        },
      },
    },
    {
      name: "firefox",
      timeout: 70_000,
      testMatch: [
        "compatibility.spec.ts",
        "firefox-repro.spec.ts",
        "playground.spec.ts",
        "help-dialog.spec.ts",
        "runtime.spec.ts",
      ],
      grep: /bundled image|help contains|accessible two-column|unobscured|within the output half|anchors help|compiled starter|native canvas|scalar fallback|migration guidance|canonical glyph|load without main!|native 800x768/,
      use: { browserName: "firefox" },
    },
  ],
  webServer: {
    command: "bun run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
})
