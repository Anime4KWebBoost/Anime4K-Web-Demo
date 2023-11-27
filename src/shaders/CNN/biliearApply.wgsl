@group(0) @binding(0) var tex_original: texture_2d<f32>;
@group(0) @binding(1) var tex_10: texture_2d<f32>;

@group(0) @binding(2) var tex_out: texture_storage_2d<rgba16float, write>;

fn colorAt(x: u32, y: u32) -> vec4f {
  return textureLoad(tex_original, vec2u(x, y), 0);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  // OOB check
  let dim_out: vec2u = textureDimensions(tex_out);
  if (pixel.x >= dim_out.x || pixel.y >= dim_out.y) {
    return;
  }
  
  let color: vec4f = colorAt(pixel.x / 2, pixel.y / 2);

  // Store the result
  textureStore(tex_out, vec2u(pixel.x, pixel.y), color);
}
