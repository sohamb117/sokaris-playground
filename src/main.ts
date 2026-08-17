import { installRuntimeHarness } from "./runtime/harness.ts"
import { mountSokarisApp } from "./ui/app.ts"
import "./ui/styles.css"

if (new URLSearchParams(window.location.search).get("runtime-test") === "1") {
  installRuntimeHarness()
} else {
  const root = document.getElementById("app")
  if (root === null) throw new TypeError("Missing app root")
  const app = mountSokarisApp(root)
  window.addEventListener("pagehide", () => app.dispose(), { once: true })
}
