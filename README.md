# Sokaris Playground

This repository contains the complete desktop Sokaris playground. The normal
`/` route is a two-column editor and output canvas that runs entirely in the
browser. A hidden `?runtime-test=1` harness remains available only for automated
runtime verification.

## Using the playground

Run `bun run dev`, open the local URL on a desktop viewport at least 1024px
wide, and edit the native code textarea. Source changes auto-run 300ms after the
last edit; there is no manual Run control.

The default program mutates the bundled starter image after the local compiler is
ready:

```julia
function invert(value::UInt8)::UInt8
    return UInt8(255 - value)
end

function main!(pixels::Vector{UInt8})
    index = 1
    channel = 1
    while index <= length(pixels)
        if channel < 4
            pixels[index] = invert(pixels[index])
        end
        channel = channel + 1
        if channel == 5
            channel = 1
        end
        index = index + 1
    end
end
```

`src/assets/input.png` is copied exactly from the project-owned sibling source
`../sokaris/inputs/input.png`. Vite ships it as a static asset, and the app
decodes it through the same browser image boundary used for selected files.

Expand the Images pane to drop or select one or more image files. The file list
keeps insertion order, while the most recently inserted or replaced image becomes
active. The compiler receives only that active image as native row-major RGBA
bytes. Programs define `main!(pixels::Vector{UInt8})` and mutate those bytes in
place; unsupported compiler constructs produce source diagnostics.

Press standalone Shift while the editor is focused to open the 14-glyph
compositor menu. Use pointer selection or ArrowUp, ArrowDown, Home, End, and
Enter; Escape, Tab, or an outside click dismisses it. The `?` button opens help
for the compiler contract, supported language constructs, scalar fallback, and
glyph meanings.

## Runtime boundary

Sokaris compiles a typed Julia subset locally to WebAssembly. It is **not full
Julia** and must never be described or presented as full Julia compatibility.
There is no backend or network evaluator.

The compiler package under `src/vendor/subset-julia-compiler/` is pinned by a
separate manifest that records source-project identity, compiler package ABI 3, generated
memory ABI 2, all artifact SHA-256 digests, and the exact `26,810,214`-byte Wasm
size. The immutable scalar interpreter package from `terasakisatoshi/subset_julia` commit
`561587e7a6f3914a24afd883a0dba52d51f3453d` is bundled under
`src/vendor/subset-julia/`. `bun run vendor` verifies all five SHA-256 digests and
the exact `26,217,180`-byte Wasm size.

Browser images are decoded locally at native dimensions into row-major
`Uint8ClampedArray` RGBA bytes. The compiler worker validates generated Wasm,
caches up to 32 modules by source and ABI, writes ABI v2 descriptors, executes
the exact `main!` export, copies output bytes, and paints them without a JavaScript
pixel transform. Source without `main!` uses the interpreter only for scalar
compatibility; source containing `load(` receives migration guidance instead of
silent fallback. Runs stop after 10 seconds and compiler initialization after 60.

## Toolchain

- Bun package manager and script runner
- Vite with vanilla TypeScript
- strict TypeScript project references
- Biome formatting and linting
- Vitest with jsdom and Testing Library DOM
- Playwright with Google Chrome stable and Firefox against the production preview

## Commands

```sh
bun install
bun run test
bun run test:e2e
bun run typecheck
bun run build
bun run check
bun run vendor
bun run loc
```

`bun run test:e2e` exercises the complete UI and hidden runtime harness in Chrome,
plus Shift, starter, help, and core compatibility coverage in Firefox. Runtime
requests remain same-origin static assets; there is no backend or external
evaluator.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` verifies and builds the app,
then publishes `dist/` whenever `main` is pushed. The production build uses
relative asset URLs, so it works for either a repository Pages URL such as
`https://<owner>.github.io/<repository>/` or a custom domain.

After pushing this repository to GitHub, open **Settings → Pages** and choose
**GitHub Actions** as the source. No deployment secrets are required. The
workflow also supports manual runs from the Actions tab.
