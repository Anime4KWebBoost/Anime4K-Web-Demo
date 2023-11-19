@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

// Function to calculate luminance
fn get_luma(rgba: vec4<f32>) -> f32 {
    return dot(rgba, vec4<f32>(0.299, 0.587, 0.114, 0.0));
}

// Implement max3v and min3v
fn max3v(a: f32, b: f32, c: f32) -> f32 {
    return max(max(a, b), c);
}

fn min3v(a: f32, b: f32, c: f32) -> f32 {
    return min(min(a, b), c);
}

// minmax3 functions adapted for WGSL
fn minmax3_x(pos: vec2<f32>, d: vec2<f32>, tex: texture_2d<f32>) -> vec2<f32> {
    let a: f32 = textureSample(tex, mySampler, pos - d).x;
    let b: f32 = textureSample(tex, mySampler, pos).x;
    let c: f32 = textureSample(tex, mySampler, pos + d).x;
    
    return vec2<f32>(min3v(a, b, c), max3v(a, b, c));
}

fn minmax3_y(pos: vec2<f32>, d: vec2<f32>, tex: texture_2d<f32>) -> vec2<f32> {
    let a0: f32 = textureSample(tex, mySampler, pos - d).g;
    let b0: f32 = textureSample(tex, mySampler, pos).g;
    let c0: f32 = textureSample(tex, mySampler, pos + d).g;

    let a1: f32 = textureSample(tex, mySampler, pos - d).b;
    let b1: f32 = textureSample(tex, mySampler, pos).b;
    let c1: f32 = textureSample(tex, mySampler, pos + d).b;

    return vec2<f32>(min3v(a0, b0, c0), max3v(a1, b1, c1));
}

// lumGaussian7 function
fn lumGaussian7(pos: vec2<f32>, d: vec2<f32>, tex: texture_2d<f32>) -> f32 {
    var g: f32 = (textureSample(tex, mySampler, pos - (d + d)).x + textureSample(tex, mySampler, pos + (d + d)).x) * 0.06136;
    g += (textureSample(tex, mySampler, pos - d).x + textureSample(tex, mySampler, pos + d).x) * 0.24477;
    g += textureSample(tex, mySampler, pos).x * 0.38774;
    
    return g;
}

// Fragment shader entry point
@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
    let STRENGTH: f32 = 0.6;
    let BLUR_CURVE: f32 = 0.6;
    let BLUR_THRESHOLD: f32 = 0.1;
    let NOISE_THRESHOLD: f32 = 0.001;

    let color: vec4<f32> = textureSample(myTexture, mySampler, fragUV);
    let luma: f32 = get_luma(color);
    // Use either minmax3_x or minmax3_y depending on the specific stage in the shader pipeline
    let minMax: vec2<f32> = minmax3_x(fragUV, vec2<f32>(1.0, 0.0), myTexture); // or minmax3_y

    var c: f32 = (luma - lumGaussian7(fragUV, vec2<f32>(1.0, 0.0), myTexture)) * STRENGTH;
    let t_range: f32 = BLUR_THRESHOLD - NOISE_THRESHOLD;
    var c_t: f32 = abs(c);
    if (c_t > NOISE_THRESHOLD) {
        c_t = (c_t - NOISE_THRESHOLD) / t_range;
        c_t = pow(c_t, BLUR_CURVE);
        c_t = c_t * t_range + NOISE_THRESHOLD;
        c_t = c_t * sign(c);
    } else {
        c_t = c;
    }

    let cc: f32 = clamp(c_t + luma, minMax.x, minMax.y) - luma;
    let resultColor: vec4<f32> = color + vec4<f32>(cc, cc, cc, 0.0);

    return resultColor;
}
