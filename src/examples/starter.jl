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
