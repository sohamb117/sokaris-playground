export const GLYPH_SOURCE = `
▷(x, f) = f(x)
🝡(x, f) = f(x)
☽(f, g) = x -> f(g(x))
⊙(a::BrowserImage, b::BrowserImage) = multiply_images(a, b)
⊙(a, b) = a .* b
∅(x, f) = map(f, x)
✧(x, f) = foldl(f, x)
⇉(f, g) = x -> (f(x), g(x))
⚕(x, default) = isnothing(x) || (x isa Number && isnan(x)) ? default : x
function ☿(f)
    cache = Dict()
    return function(x)
        if !haskey(cache, x)
            cache[x] = f(x)
        end
        cache[x]
    end
end
function ⚹(args...)
    error("Sokaris subset error: ⚹ is not supported by SubsetJuliaVM v0.12.2.")
end
✦(a, b) = [(x, y) for x in a, y in b]
☥(x) = deepcopy(x)
⚸(x, f) = accumulate(f, x)
𓇬(x::BrowserImage) = clamp_image(x)
𓇬(x) = clamp.(x, 0.0, 1.0)
`
