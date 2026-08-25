import { describe, expect, it } from "vitest"

import {
  createBrowserHostImports,
  readImageDescriptor,
} from "../src/runtime/browser-host-imports.ts"
import { BrowserImageFileSystem } from "../src/runtime/virtual-filesystem.ts"

const image = (filename: string, data: readonly number[]) => ({
  filename,
  width: 1,
  height: 1,
  data: new Uint8ClampedArray(data),
})

const fixture = () => {
  const memory = new WebAssembly.Memory({ initial: 1 })
  let next = 1024
  const allocate = (size: bigint, alignment: number): number => {
    next = Math.ceil(next / alignment) * alignment
    const pointer = next
    next += Number(size)
    if (next > memory.buffer.byteLength) {
      memory.grow(Math.ceil((next - memory.buffer.byteLength) / 65_536))
    }
    return pointer
  }
  return { memory, allocate }
}

const writeStringView = (
  memory: WebAssembly.Memory,
  allocate: (size: bigint, alignment: number) => number,
  value: string,
): number => {
  const bytes = new TextEncoder().encode(value)
  const dataPointer = allocate(BigInt(bytes.length), 1)
  new Uint8Array(memory.buffer, dataPointer, bytes.length).set(bytes)
  const viewPointer = allocate(8n, 4)
  const view = new DataView(memory.buffer)
  view.setUint32(viewPointer, dataPointer, true)
  view.setUint32(viewPointer + 4, bytes.length, true)
  return viewPointer
}

describe("browser Sokaris host imports", () => {
  it("loads exact virtual paths into a mutable module-owned ABI2 descriptor", () => {
    const { memory, allocate } = fixture()
    const filesystem = new BrowserImageFileSystem()
    filesystem.replaceInputs([image("inputs/input.png", [1, 2, 3, 4])])
    const run = filesystem.beginRun()
    const imports = createBrowserHostImports({ memory, allocate, filesystem, run })
    const path = writeStringView(memory, allocate, "inputs/input.png")
    const output = imports.sjulia_host.load(path)

    const descriptor = readImageDescriptor(memory, output)
    expect(descriptor.flags).toBe(1)
    expect(descriptor.dimensions).toEqual([4n, 1n, 1n])
    expect(descriptor.strides).toEqual([1n, 4n, 4n])
    expect(Array.from(descriptor.data)).toEqual([1, 2, 3, 4])
  })

  it("returns not-found without publishing partial outputs", () => {
    const { memory, allocate } = fixture()
    const filesystem = new BrowserImageFileSystem()
    const run = filesystem.beginRun()
    const imports = createBrowserHostImports({ memory, allocate, filesystem, run })
    const path = writeStringView(memory, allocate, "missing.png")

    expect(() => imports.sjulia_host.load(path)).toThrow("Virtual image not found: missing.png")
    expect(filesystem.outputs()).toEqual([])
  })

  it("stages strided saved descriptors until the run commits", () => {
    const { memory, allocate } = fixture()
    const filesystem = new BrowserImageFileSystem()
    const run = filesystem.beginRun()
    const imports = createBrowserHostImports({ memory, allocate, filesystem, run })
    const path = writeStringView(memory, allocate, "outputs/result.png")
    const output = allocate(88n, 8)
    const pixels = allocate(8n, 1)
    new Uint8Array(memory.buffer, pixels, 8).set([10, 20, 30, 40, 0, 0, 0, 0])
    const view = new DataView(memory.buffer)
    view.setUint32(output, 2, true)
    view.setUint32(output + 4, 1, true)
    view.setUint32(output + 8, 1, true)
    view.setUint32(output + 12, 1, true)
    view.setUint32(output + 16, 0, true)
    view.setUint32(output + 20, 3, true)
    view.setUint32(output + 24, pixels, true)
    view.setUint32(output + 28, 0, true)
    view.setBigUint64(output + 32, 4n, true)
    view.setBigUint64(output + 40, 4n, true)
    view.setBigInt64(output + 48, 1n, true)
    view.setBigUint64(output + 56, 1n, true)
    view.setBigInt64(output + 64, 4n, true)
    view.setBigUint64(output + 72, 1n, true)
    view.setBigInt64(output + 80, 8n, true)

    expect(imports.sjulia_host.save(path, output)).toBeUndefined()
    expect(filesystem.outputs()).toEqual([])

    run.commit()
    expect(filesystem.outputs()).toEqual([image("outputs/result.png", [10, 20, 30, 40])])
  })
})
