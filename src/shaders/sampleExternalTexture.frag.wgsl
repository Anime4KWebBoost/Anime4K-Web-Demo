@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

const strength: f32 = 1.0; // Defined strength value

// Helper functions
fn MinA(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>) -> f32 {
    return min(min(a.a, b.a), c.a);
}

// Adjusted MaxA function to accept three arguments
fn MaxA3(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>) -> f32 {
    return max(max(a.a, b.a), c.a);
}

// MaxA function for four arguments
fn MaxA(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>, d: vec4<f32>) -> f32 {
    return max(max(max(a.a, b.a), c.a), d.a);
}

fn Average(mc: vec4<f32>, a: vec4<f32>, b: vec4<f32>, c: vec4<f32>) -> vec4<f32> {
    return vec4(mix(mc.rgb, (a.rgb + b.rgb + c.rgb) / 3.0, strength), 1.0);
}

// Main fragment function
@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
    let texelSize = textureDimensions(myTexture, 0);
    let duv = vec4<f32>(1.0 / f32(texelSize.x), 1.0 / f32(texelSize.y), -1.0 / f32(texelSize.x), 0.0);

    let tl = textureSample(myTexture, mySampler, fragUV - duv.xy);
    let tc = textureSample(myTexture, mySampler, fragUV - duv.wy);
    let tr = textureSample(myTexture, mySampler, fragUV - duv.zy);

    let ml = textureSample(myTexture, mySampler, fragUV - duv.xw);
    let mc = textureSample(myTexture, mySampler, fragUV);
    let mr = textureSample(myTexture, mySampler, fragUV + duv.xw);

    let bl = textureSample(myTexture, mySampler, fragUV + duv.zy);
    let bc = textureSample(myTexture, mySampler, fragUV + duv.wy);
    let br = textureSample(myTexture, mySampler, fragUV + duv.xy);

    var resultColor: vec4<f32> = mc; // Default color

    // Kernel 0 and 4
    if (MinA(tl, tc, tr) > MaxA3(mc, br, bc)) {
        resultColor = Average(mc, tl, tc, tr);
    } else if (MinA(br, bc, bl) > MaxA3(mc, tl, tc)) {
        resultColor = Average(mc, br, bc, bl);
    }

    // Kernel 1 and 5
    if (MinA(mr, tc, tr) > MaxA3(mc, ml, bc)) {
        resultColor = Average(mc, mr, tc, tr);
    } else if (MinA(bl, ml, bc) > MaxA3(mc, mr, tc)) {
        resultColor = Average(mc, bl, ml, bc);
    }

    // Kernel 2 and 6
    if (MinA(mr, br, tr) > MaxA(mc, ml, tl, bl)) {
        resultColor = Average(mc, mr, br, tr);
    } else if (MinA(ml, tl, bl) > MaxA(mc, mr, br, tr)) {
        resultColor = Average(mc, ml, tl, bl);
    }

    // Kernel 3 and 7
    if (MinA(mr, br, bc) > MaxA3(mc, ml, tc)) {
        resultColor = Average(mc, mr, br, bc);
    } else if (MinA(tc, ml, tl) > MaxA3(mc, mr, bc)) {
        resultColor = Average(mc, tc, ml, tl);
    }

    return resultColor;
}
