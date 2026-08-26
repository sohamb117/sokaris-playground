const HOST_DECLARATIONS = `
load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
function save(path::String, image::Array{UInt8,3})::Nothing
    return
end
transform(name::String, image::Array{UInt8,3}, first::Float64, second::Float64, third::Float64, fourth::Float64, text::String)::Array{UInt8,3} = image

▷(value::Array{UInt8,3}, operation)::Array{UInt8,3} = operation(value)
𓇬(image::Array{UInt8,3})::Array{UInt8,3} = transform("clamp", image, 0.0, 0.0, 0.0, 0.0, "")

float(image::Array{UInt8,3})::Array{UInt8,3} = transform("float", image, 0.0, 0.0, 0.0, 0.0, "")
invert(image::Array{UInt8,3})::Array{UInt8,3} = transform("invert", image, 0.0, 0.0, 0.0, 0.0, "")

function gamma(exponent::Float64)
    return function(image::Array{UInt8,3})::Array{UInt8,3}
        return transform("gamma", image, exponent, 0.0, 0.0, 0.0, "")
    end
end

brightness(factor::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("brightness", image, factor, 0.0, 0.0, 0.0, ""); end
contrast(factor::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("contrast", image, factor, 0.0, 0.0, 0.0, ""); end
saturate(factor::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("saturate", image, factor, 0.0, 0.0, 0.0, ""); end
desaturate(factor::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("desaturate", image, factor, 0.0, 0.0, 0.0, ""); end
grayscale(image::Array{UInt8,3})::Array{UInt8,3} = transform("grayscale", image, 0.0, 0.0, 0.0, 0.0, "")
gaussian(sigma::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("gaussian", image, sigma, 0.0, 0.0, 0.0, ""); end
box_blur(size::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("box_blur", image, Float64(size), 0.0, 0.0, 0.0, ""); end
median_blur(size::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("median_blur", image, Float64(size), 0.0, 0.0, 0.0, ""); end
motion_blur(length::Int64) = motion_blur(length, 0)
motion_blur(length::Int64, angle::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("motion_blur", image, Float64(length), Float64(angle), 0.0, 0.0, ""); end
sharpen() = sharpen(1.0)
sharpen(amount::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("sharpen", image, amount, 0.0, 0.0, 0.0, ""); end
edge_detect(image::Array{UInt8,3})::Array{UInt8,3} = transform("edge_detect", image, 0.0, 0.0, 0.0, 0.0, "")
emboss(image::Array{UInt8,3})::Array{UInt8,3} = transform("emboss", image, 0.0, 0.0, 0.0, 0.0, "")
posterize(levels::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("posterize", image, Float64(levels), 0.0, 0.0, 0.0, ""); end
threshold() = threshold(0.5)
threshold(value::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("threshold", image, value, 0.0, 0.0, 0.0, ""); end
solarize() = solarize(0.5)
solarize(value::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("solarize", image, value, 0.0, 0.0, 0.0, ""); end
noise() = noise(0.1)
noise(amount::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("noise", image, amount, 0.0, 0.0, 0.0, ""); end
pixelate(block_size::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("pixelate", image, Float64(block_size), 0.0, 0.0, 0.0, ""); end
crop(x::Int64, y::Int64, width::Int64, height::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("crop", image, Float64(x), Float64(y), Float64(width), Float64(height), ""); end
crop_center(width::Int64, height::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("crop_center", image, Float64(width), Float64(height), 0.0, 0.0, ""); end
crop_to(height::Int64, width::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("crop_to", image, Float64(height), Float64(width), 0.0, 0.0, ""); end
scale_crop(height::Int64, width::Int64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("scale_crop", image, Float64(height), Float64(width), 0.0, 0.0, ""); end
glow() = glow(5.0, 0.5)
glow(blur_amount::Float64) = glow(blur_amount, 0.5)
glow(blur_amount::Float64, opacity::Float64) = function(image::Array{UInt8,3})::Array{UInt8,3}; return transform("glow", image, blur_amount, opacity, 0.0, 0.0, ""); end
text_overlay(source_file::String, height::Int64, width::Int64; font_size=12, x_offset=10, y_offset=10, fg_alpha=0.7, bg_alpha=0.0, font_face="monospace", symbol_font="Noto Sans Symbols", hieroglyph_font="Noto Sans Egyptian Hieroglyphs") = transform("text_overlay", zeros(UInt8, 4, width, height), Float64(font_size), Float64(x_offset), Float64(y_offset), fg_alpha, source_file)
`

export const composeCompiledScriptSource = (source: string): string =>
  `${HOST_DECLARATIONS}\n${source}`

export const COMPILED_SCRIPT_IMPORTS = [
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
] as const

export const compiledScriptImportsForSource = (
  source: string,
): readonly (typeof COMPILED_SCRIPT_IMPORTS)[number][] => {
  const names = new Set<string>()
  if (/\bload\s*\(/.test(source)) names.add("load")
  if (/\bsave\s*\(/.test(source)) names.add("save")
  if (
    /\b(?:float|invert|gamma|brightness|contrast|saturate|desaturate|grayscale|gaussian|box_blur|median_blur|motion_blur|sharpen|edge_detect|emboss|posterize|threshold|solarize|noise|pixelate|crop|crop_center|crop_to|scale_crop|glow|text_overlay)\b|𓇬/.test(
      source,
    )
  ) {
    names.add("transform")
  }
  return COMPILED_SCRIPT_IMPORTS.filter((entry) => names.has(entry.name))
}
