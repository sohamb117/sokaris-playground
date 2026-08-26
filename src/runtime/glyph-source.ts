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
function ⚹(array, i, j)
    neighbors = eltype(array)[]
    offsets = [(0, 1), (1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1)]
    for (di, dj) in offsets
        ni = i + di
        nj = j + dj
        if ni >= 1 && ni <= size(array, 1) && nj >= 1 && nj <= size(array, 2)
            push!(neighbors, array[ni, nj])
        end
    end
    neighbors
end
✦(a, b) = [(x, y) for x in a, y in b]
☥(x) = deepcopy(x)
⚸(x, f) = accumulate(f, x)
𓇬(x::BrowserImage) = clamp_image(x)
𓇬(x) = clamp.(x, 0.0, 1.0)
`
