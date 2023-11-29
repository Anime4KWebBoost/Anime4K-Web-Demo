@group(0) @binding(0) var tex_0: texture_2d<f32>;
@group(0) @binding(1) var tex_1: texture_2d<f32>;
@group(0) @binding(2) var tex_2: texture_2d<f32>;
@group(0) @binding(3) var tex_3: texture_2d<f32>;
@group(0) @binding(4) var tex_4: texture_2d<f32>;
@group(0) @binding(5) var tex_5: texture_2d<f32>;
@group(0) @binding(6) var tex_6: texture_2d<f32>;

@group(0) @binding(7) var tex_out: texture_storage_2d<rgba16float, write>;

fn max4(vector: vec4f, value: f32) -> vec4f {
  return max(vector, vec4f(value));
}

// can we put texture into an array (2 functions instead of 14)?
fn g_0(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_0, pos, 0), 0.0);
}

fn g_1(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_0, pos, 0), 0.0);
}

fn g_2(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_1, pos, 0), 0.0);
}

fn g_3(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_1, pos, 0), 0.0);
}

fn g_4(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_2, pos, 0), 0.0);
}

fn g_5(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_2, pos, 0), 0.0);
}

fn g_6(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_3, pos, 0), 0.0);
}

fn g_7(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_3, pos, 0), 0.0);
}

fn g_8(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_4, pos, 0), 0.0);
}

fn g_9(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_4, pos, 0), 0.0);
}

fn g_10(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_5, pos, 0), 0.0);
}

fn g_11(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_5, pos, 0), 0.0);
}

fn g_12(pos: vec2u) -> vec4f {
  return max4(textureLoad(tex_6, pos, 0), 0.0);
}

fn g_13(pos: vec2u) -> vec4f {
  return max4(-textureLoad(tex_6, pos, 0), 0.0);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  // OOB check
  let dim_out: vec2u = textureDimensions(tex_out);
  if (pixel.x >= dim_out.x || pixel.y >= dim_out.y) {
    return;
  }
  
  var result = mat4x4<f32>(0.030445501, -0.052265964, 0.01871345, -0.032196082, -0.08789084, 0.00451594, -0.035013296, 0.049980935, 0.019856643, -0.033371273, -0.012764798, -0.050311647, 0.1016879, 0.26120493, 0.15319104, 0.30260828) * g_0(pixel.xy);
  result += mat4x4<f32>(-0.011320103, 0.084351994, -0.013853055, 0.091662854, -0.00022424257, -0.047643784, -0.060312573, -0.1231358, -0.031871304, -0.014136978, 0.0032705222, 0.07787969, -0.031681746, -0.057632104, -0.08574857, -0.12985754) * g_1(pixel.xy);
  result += mat4x4<f32>(0.05320602, -0.048404478, 0.10048556, -0.026353268, -0.06601672, -0.064613424, -0.0019030399, -0.040858693, 0.2889084, 0.30683297, 0.28597072, 0.29085115, 0.0894729, 0.04317532, -0.051809974, -0.069235325) * g_2(pixel.xy);
  result += mat4x4<f32>(-0.10028094, 0.018571123, -0.11555895, 0.0074250647, 0.08632434, 0.04199708, 0.07014709, 0.0395046, -0.18092953, -0.25615, -0.16059212, -0.2242134, -0.05844784, 0.011175528, 0.022804333, 0.055179488) * g_3(pixel.xy);
  result += mat4x4<f32>(-0.0035756915, 0.029555544, -0.057007857, -0.011543149, -0.05260268, -0.13569865, 0.17767961, 0.05763981, 0.08037558, 0.0854749, -0.09117043, -0.028697504, -0.06290819, -0.052024692, 0.01357789, -0.0007758558) * g_4(pixel.xy);
  result += mat4x4<f32>(-0.0076591154, -0.054832436, 0.03104537, -0.07229308, 0.044558987, 0.1096424, -0.06388823, -0.03381543, 0.008121961, -0.0071056834, 0.019476276, 0.014538379, 0.0144254705, -0.05443686, 0.05784454, 0.00021147214) * g_5(pixel.xy);
  result += mat4x4<f32>(0.024051894, -0.01760832, 0.0828035, 0.06164727, -0.03441998, 0.00198512, 0.018536223, 0.012326052, -0.096829265, -0.09033538, 0.061622098, 0.004497285, 0.078871064, 0.065974824, -0.0076666777, -0.08943216) * g_6(pixel.xy);
  result += mat4x4<f32>(-0.0827367, -0.13351539, -0.021332163, -0.07937496, -0.023691114, -0.07576844, 0.034633763, -0.0054157176, 0.04818707, 0.13734294, -0.0491794, -0.040830683, -0.014140617, -0.053490162, 0.01728071, 0.088826664) * g_7(pixel.xy);
  result += mat4x4<f32>(0.055253997, -0.016022734, -0.07637242, -0.032335658, -0.0668001, -0.14762713, 0.05597752, 0.014707982, 0.004930473, -0.14050685, -0.028585805, 0.021917267, 0.08642902, 0.04652173, -0.01584847, -0.016214162) * g_8(pixel.xy);
  result += mat4x4<f32>(-0.047325704, 0.007658281, 0.1395665, 0.034603175, -0.079251006, 0.082055256, 0.0818267, 0.111324936, 0.09762098, 0.1785905, -0.036907803, -0.14729157, -0.059522513, -0.04754573, 0.053542215, -0.04370413) * g_9(pixel.xy);
  result += mat4x4<f32>(-0.13521186, -0.065591395, 0.023284486, 0.09420268, 0.13622068, -0.022057435, -0.042552732, -0.027567035, -0.030387424, -0.07810714, 0.014374227, 0.09920431, 0.048217654, 0.1090012, -0.07694576, -0.02600855) * g_10(pixel.xy);
  result += mat4x4<f32>(0.1307021, 0.03766495, -0.10179733, -0.010970625, -0.06020565, 0.050316818, -0.056756098, 0.03114012, 0.028388757, -0.034492534, 0.039500885, -0.08915758, 0.03761112, -0.11821317, 0.043239858, 0.08695215) * g_11(pixel.xy);
  result += mat4x4<f32>(0.031210948, 0.08761116, 0.01767844, -0.055869993, 0.19191101, -0.115752295, 0.055158403, -0.078982204, -0.058509402, -0.10978919, 0.06622744, -0.024440672, 0.006510303, 0.09053071, 0.041478187, -0.11237255) * g_12(pixel.xy);
  result += mat4x4<f32>(-0.08888559, -0.0175886, -0.07919481, 0.1301304, -0.08967372, 0.013421654, 0.0213782, -0.01923792, -0.07347132, 0.23006114, -0.16629104, 0.14273474, 0.014865724, -0.077135175, 0.046202764, 0.110953994) * g_13(pixel.xy);
  result += vec4f(-0.09315623, -0.01892607, -0.018664315, 0.05707644);

  // Store the result
  textureStore(tex_out, vec2u(pixel.x, pixel.y), result);
}
