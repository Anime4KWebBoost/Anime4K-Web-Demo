@group(0) @binding(0) var tex_0: texture_2d<f32>;
@group(0) @binding(1) var tex_1: texture_2d<f32>;
@group(0) @binding(2) var tex_2: texture_2d<f32>;
@group(0) @binding(3) var tex_3: texture_2d<f32>;
@group(0) @binding(4) var tex_4: texture_2d<f32>;
@group(0) @binding(5) var tex_5: texture_2d<f32>;
@group(0) @binding(6) var tex_6: texture_2d<f32>;

@group(0) @binding(7) var tex_out: texture_storage_2d<rgba16float, write>;

fn colorAt(x: u32, y: u32) -> vec4f {
  return textureLoad(tex_6, vec2u(x, y), 0);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  // OOB check
  let dim_out: vec2u = textureDimensions(tex_out);
  if (pixel.x >= dim_out.x || pixel.y >= dim_out.y) {
    return;
  }
  
  let color: vec4f = colorAt(pixel.x, pixel.y);

  // Store the result
  textureStore(tex_out, vec2u(pixel.x, pixel.y), color);
}
