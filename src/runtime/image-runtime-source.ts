export const IMAGE_RUNTIME_SOURCE = `
struct BrowserImage
    width::Int
    height::Int
    data::Vector{Float64}
end
copy_image(img::BrowserImage) = BrowserImage(img.width, img.height, copy(img.data))
clamp_channel(value) = clamp(value, 0.0, 1.0)
function map_rgb(img::BrowserImage, transform)
    output = copy(img.data)
    for index in 1:4:length(output)
        output[index] = clamp_channel(transform(output[index]))
        output[index + 1] = clamp_channel(transform(output[index + 1]))
        output[index + 2] = clamp_channel(transform(output[index + 2]))
    end
    BrowserImage(img.width, img.height, output)
end
clamp_image(img::BrowserImage) = map_rgb(img, value -> value)
function multiply_images(a::BrowserImage, b::BrowserImage)
    if a.width != b.width || a.height != b.height
        error("Sokaris subset error: image dimensions must match for ⊙.")
    end
    output = copy(a.data)
    for index in 1:4:length(output)
        output[index] = clamp_channel(a.data[index] * b.data[index])
        output[index + 1] = clamp_channel(a.data[index + 1] * b.data[index + 1])
        output[index + 2] = clamp_channel(a.data[index + 2] * b.data[index + 2])
        output[index + 3] = clamp_channel(a.data[index + 3] * b.data[index + 3])
    end
    BrowserImage(a.width, a.height, output)
end
function invert(img::BrowserImage)
    map_rgb(img, value -> 1.0 - value)
end
function gamma(value)
    if !isfinite(value) || value <= 0
        error("Sokaris subset error: gamma must be finite and greater than zero.")
    end
    img -> map_rgb(img, channel -> channel ^ value)
end
function brightness(value)
    if !isfinite(value)
        error("Sokaris subset error: brightness must be finite.")
    end
    img -> map_rgb(img, channel -> channel + value)
end
function contrast(value)
    if !isfinite(value) || value < 0
        error("Sokaris subset error: contrast must be finite and non-negative.")
    end
    img -> map_rgb(img, channel -> (channel - 0.5) * value + 0.5)
end
function grayscale(img::BrowserImage)
    output = copy(img.data)
    for index in 1:4:length(output)
        gray = 0.2126 * output[index] + 0.7152 * output[index + 1] + 0.0722 * output[index + 2]
        output[index] = gray
        output[index + 1] = gray
        output[index + 2] = gray
    end
    BrowserImage(img.width, img.height, output)
end
function posterize(levels)
    if !(levels isa Int) || levels < 2
        error("Sokaris subset error: posterize levels must be an integer of at least 2.")
    end
    img -> map_rgb(img, channel -> round(channel * (levels - 1)) / (levels - 1))
end
function threshold(value = 0.5)
    if !isfinite(value) || value < 0 || value > 1
        error("Sokaris subset error: threshold must be finite and in [0, 1].")
    end
    img -> map_rgb(img, channel -> channel > value ? 1.0 : 0.0)
end
function solarize(value = 0.5)
    if !isfinite(value) || value < 0 || value > 1
        error("Sokaris subset error: solarize threshold must be finite and in [0, 1].")
    end
    img -> map_rgb(img, channel -> channel > value ? 1.0 - channel : channel)
end
function pixelate(block_size)
    if !(block_size isa Int) || block_size < 1
        error("Sokaris subset error: pixelate block size must be a positive integer.")
    end
    return function(img)
        output = copy(img.data)
        for y in 1:block_size:img.height
            for x in 1:block_size:img.width
                x_end = min(img.width, x + block_size - 1)
                y_end = min(img.height, y + block_size - 1)
                count = (x_end - x + 1) * (y_end - y + 1)
                red = 0.0
                green = 0.0
                blue = 0.0
                for sample_y in y:y_end
                    for sample_x in x:x_end
                        index = ((sample_y - 1) * img.width + sample_x - 1) * 4 + 1
                        red += img.data[index]
                        green += img.data[index + 1]
                        blue += img.data[index + 2]
                    end
                end
                for output_y in y:y_end
                    for output_x in x:x_end
                        index = ((output_y - 1) * img.width + output_x - 1) * 4 + 1
                        output[index] = red / count
                        output[index + 1] = green / count
                        output[index + 2] = blue / count
                    end
                end
            end
        end
        BrowserImage(img.width, img.height, output)
    end
end
`
