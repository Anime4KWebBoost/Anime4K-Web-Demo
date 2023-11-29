@group(0) @binding(0) var tex_original: texture_2d<f32>;
@group(0) @binding(1) var tex_10: texture_2d<f32>;

@group(0) @binding(2) var tex_out: texture_storage_2d<rgba16float, write>;

fn colorAt(texture: texture_2d<f32>, x: u32, y: u32) -> vec4<f32> {
  return textureLoad(texture, vec2<i32>(i32(x), i32(y)), 0);
}
fn getUVCoordinates(i: u32, j: u32, m: u32, n: u32) -> vec2<f32> {
    let u = f32(i) / f32(m - 1);
    let v = f32(j) / f32(n - 1);
    return vec2<f32>(u, v);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  // OOB check
  let dim_out: vec2u = textureDimensions(tex_out);
  if (pixel.x >= dim_out.x || pixel.y >= dim_out.y) {
    return;
  }

  let color_tex_10: vec4<f32> = colorAt(tex_10, pixel.x, pixel.y);
  
  let uv: vec2<f32> = getUVCoordinates(pixel.x, pixel.y, dim_out.x, dim_out.y);

  let color_tex_original: vec4<f32> = colorAt(tex_original, u32(uv.x * f32(textureDimensions(tex_original).x)), u32(uv.y * f32(textureDimensions(tex_original).y)));

  let combined_color: vec4<f32> = color_tex_10 + color_tex_original;
  textureStore(tex_out, vec2u(pixel.x, pixel.y), combined_color);
}