@group(0) @binding(0) var tex_7: texture_2d<f32>;
@group(0) @binding(1) var tex_8: texture_2d<f32>;
@group(0) @binding(2) var tex_9: texture_2d<f32>;
@group(0) @binding(3) var tex_out: texture_storage_2d<rgba16float, write>;

fn colorAt(texture: texture_2d<f32>, x: u32, y: u32) -> vec4<f32> {
    return textureLoad(texture, vec2<i32>(i32(x), i32(y)), 0);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  var tex_7_size: vec2u = textureDimensions(tex_7);
  var tex_8_size: vec2u = textureDimensions(tex_8);
  var tex_9_size: vec2u = textureDimensions(tex_9);
    let dim_out: vec2u = textureDimensions(tex_out);
    if (pixel.x >= dim_out.x || pixel.y >= dim_out.y) {
        return;
    }

    let f0 = fract(vec2<f32>(pixel.xy) * (f32(tex_7_size.x) * f32(tex_7_size.y)));
    let i0 = vec2<u32>(u32(f0.x * 2.0), u32(f0.y * 2.0));
    let c0 = colorAt(tex_7, i0.x, i0.y).x;

    let f1 = fract(vec2<f32>(pixel.xy) * (f32(tex_8_size.x) * f32(tex_8_size.y)));
    let i1 = vec2<u32>(u32(f1.x * 2.0), u32(f1.y * 2.0));
    let c1 = colorAt(tex_8, i1.x, i1.y).x;

    let f2 = fract(vec2<f32>(pixel.xy) * (f32(tex_9_size.x) * f32(tex_9_size.y)));
    let i2 = vec2<u32>(u32(f2.x * 2.0), u32(f2.y * 2.0));
    let c2 = colorAt(tex_9, i2.x, i2.y).x;

    let c3 = c2;

    let color = vec4<f32>(c0, c1, c2, c3); // ???? Add any additional logic for MAIN_tex if needed

    textureStore(tex_out, vec2u(pixel.x, pixel.y), color);
}
