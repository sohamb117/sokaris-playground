import { describe, expect, it } from "vitest"

import {
  COMPILED_SCRIPT_IMPORTS,
  composeCompiledScriptSource,
} from "../src/runtime/compiled-script-source.ts"

describe("compiled script source", () => {
  it("prepends typed host declarations without rewriting visible source", () => {
    const source = `image = load("inputs/input.png")
save("output.png", image)`

    const compiled = composeCompiledScriptSource(source)

    expect(compiled.endsWith(source)).toBe(true)
    expect(compiled).toContain("load(path::String)::Array{UInt8,3}")
    expect(compiled).toContain("save(path::String, image::Array{UInt8,3})::Nothing")
  })

  it("declares exact browser image imports", () => {
    expect(COMPILED_SCRIPT_IMPORTS).toEqual([
      {
        module: "sjulia_host",
        name: "load",
        function_name: "load",
        params: ["String"],
        result: "Array{UInt8,3}",
      },
      {
        module: "sjulia_host",
        name: "save",
        function_name: "save",
        params: ["String", "Array{UInt8,3}"],
      },
    ])
  })
})
