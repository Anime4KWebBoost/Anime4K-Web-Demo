@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var tex_out: texture_2d<f32>;
@group(0) @binding(2) var<uniform> enable_comparison: u32;
@group(0) @binding(3) var tex_origin: texture_2d<f32>;
@group(0) @binding(4) var<uniform> splitRatio: f32;

@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
    let color_origin = textureSample(tex_origin, mySampler, fragUV);
    let color_out = textureSample(tex_out, mySampler, fragUV);
    // comparison split render
    if (enable_comparison == 1) {
        if (fragUV.x < splitRatio - 0.001) {
            // left half screen
            return color_origin;
        }
        if (fragUV.x < splitRatio + 0.001) {
            // red split bar
            return vec4f(1.0, 0, 0, 1.0);
        }
    }

    return color_out;
}
