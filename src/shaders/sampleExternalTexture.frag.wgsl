@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> strength: f32;

fn get_luma(rgba: vec4<f32>) -> f32 {
    return dot(rgba, vec4<f32>(0.299, 0.587, 0.114, 0.0));
}

fn max3v(a: f32, b: f32, c: f32) -> f32 {
    return max(max(a, b), c);
}

fn min3v(a: f32, b: f32, c: f32) -> f32 {
    return min(min(a, b), c);
}

// Specific Shader Functions
fn minmax3(pos: vec2<f32>, d: vec2<f32>, tex: texture_2d<f32>, component: i32) -> vec2<f32> {
    let a: vec4<f32> = textureSample(tex, mySampler, pos - d);
    let b: vec4<f32> = textureSample(tex, mySampler, pos);
    let c: vec4<f32> = textureSample(tex, mySampler, pos + d);

    var minVal: f32 = 0.0;
    var maxVal: f32 = 0.0;

    if (component == 0) {
        minVal = min3v(a.r, b.r, c.r);
        maxVal = max3v(a.r, b.r, c.r);
    } else if (component == 1) {
        minVal = min3v(a.g, b.g, c.g);
        maxVal = max3v(a.g, b.g, c.g);
    } else if (component == 2) {
        minVal = min3v(a.b, b.b, c.b);
        maxVal = max3v(a.b, b.b, c.b);
    }

    return vec2<f32>(minVal, maxVal);
}

fn lumGaussian7(pos: vec2<f32>, d: vec2<f32>, tex: texture_2d<f32>) -> f32 {
    var g: f32 = (textureSample(tex, mySampler, pos - (d + d)).x + textureSample(tex, mySampler, pos + (d + d)).x) * 0.06136;
    g += (textureSample(tex, mySampler, pos - d).x + textureSample(tex, mySampler, pos + d).x) * 0.24477;
    g += textureSample(tex, mySampler, pos).x * 0.38774;
    
    return g;
}

@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
    let BLUR_CURVE: f32 = 1.0;
    let BLUR_THRESHOLD: f32 = 0.1;
    let NOISE_THRESHOLD: f32 = 0.001;

    let color: vec4<f32> = textureSample(myTexture, mySampler, fragUV);
    let luma: f32 = get_luma(color);

    let minMax: vec2<f32> = minmax3(fragUV, vec2<f32>(1.0, 0.0), myTexture, 0);

    var c: f32 = (luma - lumGaussian7(fragUV, vec2<f32>(1.0, 0.0), myTexture)) * strength;
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
    return color + vec4<f32>(cc, cc, cc, 0.0);
}
