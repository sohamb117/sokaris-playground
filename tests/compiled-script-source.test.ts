import { describe, expect, it } from "vitest"

import {
  COMPILED_SCRIPT_IMPORTS,
  compiledScriptImportsForSource,
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
    expect(compiled).toContain(
      "▷(value::Array{UInt8,3}, operation)::Array{UInt8,3} = operation(value)",
    )
    expect(compiled).toContain("function gamma(exponent::Float64)")
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
      {
        module: "sjulia_host",
        name: "transform",
        function_name: "transform",
        params: ["String", "Array{UInt8,3}", "Float64", "Float64", "Float64", "Float64", "String"],
        result: "Array{UInt8,3}",
      },
    ])
  })

  it("requests only imports used by visible source", () => {
    expect(
      compiledScriptImportsForSource('image = load("input.png")').map(({ name }) => name),
    ).toEqual(["load"])
    expect(
      compiledScriptImportsForSource(
        'image = load("input.png")\nresult = gamma(0.85)(image)\nsave("out.png", result)',
      ).map(({ name }) => name),
    ).toEqual(["load", "save", "transform"])
  })
})
