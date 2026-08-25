const HOST_DECLARATIONS = `
load(path::String)::Array{UInt8,3} = Array{UInt8,3}(undef, 0, 0, 0)
function save(path::String, image::Array{UInt8,3})::Nothing
    return
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
