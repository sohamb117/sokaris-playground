const HOST_DECLARATIONS = `
load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
function save(path::String, image::Array{UInt8,3})::Nothing
    return
end

▷(value, transform) = transform(value)

function gamma(exponent::Float64)
    return function(image::Array{UInt8,3})::Array{UInt8,3}
        width = size(image, 2)
        height = size(image, 3)
        y = 1
        while y <= height
            x = 1
            while x <= width
                channel = 1
                while channel <= 3
                    normalized = Float64(image[channel, x, y]) / 255.0
                    corrected = normalized ^ exponent
                    image[channel, x, y] = UInt8(round(corrected * 255.0))
                    channel = channel + 1
                end
                x = x + 1
            end
            y = y + 1
        end
        return image
    end
end
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
] as const
