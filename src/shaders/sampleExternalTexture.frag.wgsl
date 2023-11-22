@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_external;
@group(0) @binding(3) var<uniform> strength: vec4<f32>;

@fragment
fn main(@location(0) fragUV : vec2<f32>) -> @location(0) vec4<f32> {
  let color: vec4<f32> = textureSampleBaseClampToEdge(myTexture, mySampler, fragUV);
  return (color + strength) / 2.0;
}
