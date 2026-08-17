# Sokaris Playground

This repository contains the complete desktop Sokaris playground. The normal
`/` route is a two-column editor and output canvas that runs entirely in the
browser. A hidden `?runtime-test=1` harness remains available only for automated
runtime verification.

## Using the playground

Run `bun run dev`, open the local URL on a desktop viewport at least 1024px
wide, and edit the native code textarea. Source changes auto-run 300ms after the
last edit; there is no manual Run control.

The default program works without an image:

```julia
result = 21 ▷ (x -> x * 2)
```

Expand the Images pane to drop or select one or more image files. Filenames are
registered exactly as shown, so an image can be loaded and transformed with:

```julia
result = load("photo.png") ▷ invert
```

Each image is proportionally rasterized, without upscaling, into a maximum
32×32 VM working preview because SubsetJuliaVM cannot practically parse
full-resolution numeric image literals.

Press standalone Shift while the editor is focused to open the 14-glyph
compositor menu. Use pointer selection or ArrowUp, ArrowDown, Home, End, and
Enter; Escape, Tab, or an outside click dismisses it. The `?` button opens help
for image loading, `result`, transforms, and glyph meanings.

## Runtime boundary

Sokaris runs locally in the browser on **SubsetJuliaVM v0.12.2**, a Rust/Wasm
implementation of a Julia subset. It is **not full Julia** and must never be
described or presented as full Julia compatibility. There is no backend or
network evaluator.

The immutable package from `terasakisatoshi/subset_julia` commit
`561587e7a6f3914a24afd883a0dba52d51f3453d` is bundled under
`src/vendor/subset-julia/`. `bun run vendor` verifies all five SHA-256 digests and
the exact `26,217,180`-byte Wasm size.

Browser images are decoded locally into the maximum 32×32 VM working preview as
normalized row-major RGBA data. This is input rasterization only: image
transforms execute in VM-side Julia source. TypeScript decodes and marshals
inputs, controls worker lifecycle, validates output pixels, and paints the
canvas. Supported transforms are `invert`, `gamma`, `brightness`, `contrast`,
`grayscale`, `posterize`, `threshold`, `solarize`, and `pixelate`. Other known
Imhotep operations return an explicit SubsetJuliaVM error. Of the 14 Sokaris
glyphs, 13 are runtime-probed; `⚹` is explicitly unsupported because this VM
does not implement the sibling definition's `checkbounds` call.

## Toolchain

- Bun package manager and script runner
- Vite with vanilla TypeScript
- strict TypeScript project references
- Biome formatting and linting
- Vitest with jsdom and Testing Library DOM
- Playwright with Google Chrome stable against the production preview

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

`bun run test:e2e` builds and exercises the complete UI and hidden runtime
harness against the local production preview. Runtime requests remain
same-origin; there is no backend or external evaluator.
