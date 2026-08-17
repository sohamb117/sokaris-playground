export const UNSUPPORTED_TRANSFORMS = [
  "gaussian",
  "box_blur",
  "median_blur",
  "motion_blur",
  "saturate",
  "desaturate",
  "sharpen",
  "edge_detect",
  "emboss",
  "noise",
  "crop",
  "crop_center",
  "crop_to",
  "scale_crop",
  "glow",
  "text_overlay",
  "save",
] as const

export const UNSUPPORTED_SOURCE = UNSUPPORTED_TRANSFORMS.map(
  (name) =>
    `function ${name}(args...)\nerror("Sokaris subset error: ${name} is not supported by SubsetJuliaVM v0.12.2.")\nend`,
).join("\n")
