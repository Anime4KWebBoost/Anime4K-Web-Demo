@group(0) @binding(0) var tex_original: texture_2d<f32>;
@group(0) @binding(1) var tex_10: texture_2d<f32>;
@group(0) @binding(2) var tex_out: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> comparisonEnabled: f32;

fn getUVCoordinates(i: u32, j: u32, m: u32, n: u32) -> vec2<f32> {
    let u = f32(i) / f32(m - 1);
    let v = f32(j) / f32(n - 1);
    return vec2<f32>(u, v);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  let dim_out: vec2u = textureDimensions(tex_out);
  if (pixel.x >= dim_out.x || pixel.y >= dim_out.y) {
    return;
  }

  let uv: vec2<f32> = getUVCoordinates(pixel.x, pixel.y, dim_out.x, dim_out.y);
  let coordOriginal: vec2<i32> = vec2<i32>(uv * vec2<f32>(textureDimensions(tex_original)));
  let coord10: vec2<i32> = vec2<i32>(uv * vec2<f32>(textureDimensions(tex_10)));

  let color_original: vec4<f32> = textureLoad(tex_original, coordOriginal, 0);
  let color_10: vec4<f32> = textureLoad(tex_10, coord10, 0);

  let combined_color: vec4<f32> = color_original + color_10;

  // comparison
  if (comparisonEnabled == 1.0) {
    if (pixel.x < dim_out.x / 2 - 2) {
    textureStore(tex_out, vec2u(pixel.x, pixel.y), textureLoad(tex_original, vec2u(pixel.x, pixel.y), 0));
    return;
    }
    if (pixel.x <= dim_out.x / 2 + 2) {
      textureStore(tex_out, vec2u(pixel.x, pixel.y), vec4(1.0, 0, 0, 1));
      return;
    }
  }
  
  textureStore(tex_out, vec2u(pixel.x, pixel.y), combined_color);
}
