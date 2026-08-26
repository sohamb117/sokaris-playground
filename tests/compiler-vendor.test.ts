import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { beforeAll, describe, expect, it } from "vitest"

import { STARTER_SOURCE } from "../src/examples/starter.ts"
import {
  COMPILED_SCRIPT_IMPORTS,
  composeCompiledScriptSource,
} from "../src/runtime/compiled-script-source.ts"
import {
  executeCompiledImage,
  formatCompilerDiagnostics,
  parseCompilerResult,
} from "../src/runtime/compiler-contract.ts"
import { executeCompiledScript } from "../src/runtime/script-executor.ts"
import { BrowserImageFileSystem } from "../src/runtime/virtual-filesystem.ts"
import initCompiler, {
  compile_to_wasm,
} from "../src/vendor/subset-julia-compiler/subset_julia_vm_web.js"

const compile = (source: string): unknown =>
  compile_to_wasm(source, {
    source_name: "test.jl",
    opt_level: 2,
    exports: [{ export_name: "main!", function_name: "main!", arg_types: ["Vector{UInt8}"] }],
  })

const compileExport = (
  source: string,
  exportName: string,
  functionName: string,
  argTypes: readonly string[],
): unknown =>
  compile_to_wasm(source, {
    source_name: "edge.jl",
    opt_level: 2,
    exports: [{ export_name: exportName, function_name: functionName, arg_types: [...argTypes] }],
  })

beforeAll(async () => {
  const path = resolve(
    import.meta.dirname,
    "../src/vendor/subset-julia-compiler/subset_julia_vm_web_bg.wasm",
  )
  await initCompiler({ module_or_path: await readFile(path) })
})

describe("vendored general compiler", () => {
  it("compiles top-level scripts with typed image imports", async () => {
    const raw = compile_to_wasm(
      `load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
image = load("inputs/input.png")`,
      {
        source_name: "script.jl",
        opt_level: 2,
        entry_mode: "script",
        imports: [
          {
            module: "sjulia_host",
            name: "load",
            function_name: "load",
            params: ["String"],
            result: "Array{UInt8,3}",
          },
        ],
      },
    )

    const compiled = parseCompilerResult(raw)
    const module = await WebAssembly.compile(compiled.bytes)

    expect(compiled.entryPoint).toBe("__sjulia_script_entry")
    expect(compiled.imports).toEqual([
      {
        module: "sjulia_host",
        name: "load",
        functionName: "load",
        params: ["String"],
        result: "Array{UInt8, 3}",
      },
    ])
    expect(WebAssembly.Module.imports(module)).toEqual([
      { module: "sjulia_host", name: "load", kind: "function" },
    ])
  })

  it("compiles captured multi-statement closures in script mode", async () => {
    // Given
    const raw = compile_to_wasm(
      `function gamma(exponent::Float64)
    return function(channel::Float64)::Float64
        adjusted = channel ^ exponent
        return adjusted
    end
end
correct = gamma(0.85)
result = correct(0.25)`,
      { source_name: "closure-script.jl", opt_level: 2, entry_mode: "script" },
    )

    // When
    const compiled = parseCompilerResult(raw)
    const module = await WebAssembly.compile(compiled.bytes)
    const instance = await WebAssembly.instantiate(module, {})
    const entry = compiled.entryPoint && Reflect.get(instance.exports, compiled.entryPoint)

    // Then
    expect(typeof entry).toBe("function")
    if (typeof entry === "function") entry()
  })

  it("executes browser-backed load and save as a transaction", async () => {
    const raw = compile_to_wasm(
      `load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
function save(path::String, image::Array{UInt8,3})::Nothing
    return
end
image = load("inputs/input.png")
save("outputs/result.png", image)`,
      {
        source_name: "load-save.jl",
        opt_level: 2,
        entry_mode: "script",
        imports: [
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
        ],
      },
    )
    const compiled = parseCompilerResult(raw)
    const module = await WebAssembly.compile(compiled.bytes)
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([
      {
        filename: "inputs/input.png",
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([10, 20, 30, 40]),
      },
    ])

    const outputs = await executeCompiledScript(module, compiled, filesystem)

    expect(outputs).toEqual([
      {
        filename: "outputs/result.png",
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([10, 20, 30, 40]),
      },
    ])
  })

  it("executes the exact load gamma save script without mutating input", async () => {
    // Given
    const source = composeCompiledScriptSource(`image = load("inputs/input.png")
corrected = gamma(0.85)(image)
save("outputs/gamma.png", corrected)`)
    const raw = compile_to_wasm(source, {
      source_name: "gamma-script.jl",
      opt_level: 2,
      entry_mode: "script",
      imports: COMPILED_SCRIPT_IMPORTS.map((entry) => ({
        ...entry,
        params: [...entry.params],
      })),
    })
    const compiled = parseCompilerResult(raw)
    const module = await WebAssembly.compile(compiled.bytes)
    const original = new Uint8ClampedArray([64, 128, 192, 255])
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([
      { filename: "inputs/input.png", width: 1, height: 1, data: original },
    ])

    // When
    const outputs = await executeCompiledScript(module, compiled, filesystem)

    // Then
    const gammaByte = (value: number): number => Math.round((value / 255) ** 0.85 * 255)
    expect(outputs).toEqual([
      {
        filename: "outputs/gamma.png",
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([gammaByte(64), gammaByte(128), gammaByte(192), 255]),
      },
    ])
    expect(original).toEqual(new Uint8ClampedArray([64, 128, 192, 255]))
  })

  it("compiles and runs the exact helper, loop, and branch starter", async () => {
    // Given
    const compiled = parseCompilerResult(compile(STARTER_SOURCE))
    const module = await WebAssembly.compile(compiled.bytes)
    const data = new Uint8ClampedArray([0, 64, 128, 255, 1, 2, 3, 254])

    // When
    const result = await executeCompiledImage(module, {
      filename: "tiny.png",
      width: 2,
      height: 1,
      data,
    })

    // Then
    expect(result.data).toEqual(new Uint8ClampedArray([255, 191, 127, 255, 254, 253, 252, 254]))
  })

  it("reports an explicit diagnostic for unsupported dynamic String construction", () => {
    // Given
    const result = compile(`function main!(pixels::Vector{UInt8})
    label = String(pixels)
end`)

    // When
    const diagnostic = formatCompilerDiagnostics(result)

    // Then
    expect(diagnostic).toContain("unsupported")
    expect(diagnostic).toContain("Convert")
    expect(diagnostic).toContain("target_ty: Str")
  })

  it("preserves UInt8 wrapping and unsigned widening in the shipped compiler", async () => {
    // Given
    const source = `wrapped()::Int64 = Int64(UInt8(0) - UInt8(1))`
    const compiled = parseCompilerResult(compileExport(source, "wrapped_alias", "wrapped", []))
    const module = await WebAssembly.compile(compiled.bytes)
    const instance = await WebAssembly.instantiate(module, {})

    // When
    const result = Reflect.get(instance.exports, "wrapped_alias")

    // Then
    expect(typeof result).toBe("function")
    if (typeof result === "function") expect(result()).toBe(255n)
    expect(Reflect.get(instance.exports, "wrapped")).toBeUndefined()
  })

  it("rejects an ambiguous implicit return instead of emitting a loop", () => {
    // Given
    const source = `function twice(value::Int64)::Int64
    output = value * 2
    output
end`

    // When
    const diagnostic = formatCompilerDiagnostics(compileExport(source, "twice", "twice", ["Int64"]))

    // Then
    expect(diagnostic).toContain("unsupported")
    expect(diagnostic).toContain("no unambiguous return value")
  })
})
