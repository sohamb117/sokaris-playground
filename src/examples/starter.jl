image = load("input.png")
result = image ▷ invert ▷ gamma(0.85) ▷ noise(0.1) ▷ gaussian(2) ▷ 𓇬
save("output.png", result)
