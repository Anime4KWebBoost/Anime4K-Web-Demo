import { makeSample, SampleInit } from '../../components/SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';
import luminationWGSL from '../../shaders/lumination.wgsl';
import deblurDoGXWGSL from '../../shaders/deblurDoGX.wgsl';
import deblurDoGYWGSL from '../../shaders/deblurDoGY.wgsl';
import deblurDoGApplyWGSL from '../../shaders/deblurDoGApply.wgsl';

const init: SampleInit = async ({ canvas, pageState, gui, videoURL }) => {
  // Set video element
  const video = document.createElement('video');
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.src = videoURL;
  await video.play();
  
  // constants
  let WIDTH = video.videoWidth;
  let HEIGHT = video.videoHeight;

  // maintain canvas aspect ratio
  const aspectRatio = HEIGHT / WIDTH;
  canvas.style.height = `calc(80vw * ${aspectRatio})`;

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();


  if (!pageState.active) return;

  // connect canvas to webGPU
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  // configure lumination pipeline
  const luminationBindGroupLayout = device.createBindGroupLayout({
    label: "lumination Bind Group Layout",
    entries: [
      {
        binding: 0, // input frame as texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 1, // output texture
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: "write-only",
          format: "rgba16float",
        },
      }
    ]
  });

  const luminationModule = device.createShaderModule({
    label: 'lumination shader',
    code: luminationWGSL,
  });

  const luminationPipelineLayout = device.createPipelineLayout({
    label: "lumination pipeline layout",
    bindGroupLayouts: [ luminationBindGroupLayout ],
  });

  const luminationPipeline = device.createComputePipeline({
    label: 'lumination pipeline',
    layout: luminationPipelineLayout,
    compute: {
      module: luminationModule,
      entryPoint: 'computeMain',
    }
  });

  // preparing textures for compute pipeline
  // bind 0: input frame texture
  const videoFrameTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
  });
  // update function to be called within frame loop
  function updateVideoFrameTexture() {
    // Copy the current video frame to the texture
    device.queue.copyExternalImageToTexture(
      { source: video },
      { texture: videoFrameTexture },
      [ WIDTH, HEIGHT ]
    );
  }

  // image texture for static testing
  const imgBitmap = await createImageBitmap(await (await fetch('../assets/image/ttes.jpg')).blob());
  const imageTexture = device.createTexture({
    size: [imgBitmap.width, imgBitmap.height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: imgBitmap }, { texture: imageTexture }, [imgBitmap.width, imgBitmap.height]);
  WIDTH = imgBitmap.width;
  HEIGHT = imgBitmap.height;

  // bind 1: output texture
  const luminationTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });

  // configure deblurDoGX pipeline
  const deblurDoGXBindGroupLayout = device.createBindGroupLayout({
    label: "deblurDoGX Bind Group Layout",
    entries: [
      {
        binding: 0, // input frame as texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 1, // output texture
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: "write-only",
          format: "rgba16float",
        },
      }
    ]
  });

  const deblurDoGXModule = device.createShaderModule({
    label: 'deblurDoGX shader',
    code: deblurDoGXWGSL,
  });

  const deblurDoGXPipelineLayout = device.createPipelineLayout({
    label: "deblurDoGX pipeline layout",
    bindGroupLayouts: [ deblurDoGXBindGroupLayout ],
  });

  const deblurDoGXPipeline = device.createComputePipeline({
    label: 'deblurDoGX pipeline',
    layout: deblurDoGXPipelineLayout,
    compute: {
      module: deblurDoGXModule,
      entryPoint: 'computeMain',
    }
  });

  // bind 1: output texture
  const deblurDoGXTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });

  // configure deblurDoGY pipeline
  const deblurDoGYBindGroupLayout = device.createBindGroupLayout({
    label: "deblurDoGY Bind Group Layout",
    entries: [
      {
        binding: 0, // input frame as texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 1, // output texture
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: "write-only",
          format: "rgba16float",
        },
      }
    ]
  });

  const deblurDoGYModule = device.createShaderModule({
    label: 'deblurDoGY shader',
    code: deblurDoGYWGSL,
  });

  const deblurDoGYPipelineLayout = device.createPipelineLayout({
    label: "deblurDoGY pipeline layout",
    bindGroupLayouts: [ deblurDoGYBindGroupLayout ],
  });

  const deblurDoGYPipeline = device.createComputePipeline({
    label: 'deblurDoGY pipeline',
    layout: deblurDoGYPipelineLayout,
    compute: {
      module: deblurDoGYModule,
      entryPoint: 'computeMain',
    }
  });

  // bind 1: output texture
  const deblurDoGYTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });

  // configure deblurDoGApply pipeline
  const deblurDoGApplyBindGroupLayout = device.createBindGroupLayout({
    label: "deblurDoGApply Bind Group Layout",
    entries: [
      {
        binding: 0, // input frame as texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 3, // output texture
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: "write-only",
          format: "rgba16float",
        },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      },
    ]
  });

  const deblurDoGApplyModule = device.createShaderModule({
    label: 'deblurDoGApply shader',
    code: deblurDoGApplyWGSL,
  });

  const deblurDoGApplyPipelineLayout = device.createPipelineLayout({
    label: "deblurDoGApply pipeline layout",
    bindGroupLayouts: [ deblurDoGApplyBindGroupLayout ],
  });

  const deblurDoGApplyPipeline = device.createComputePipeline({
    label: 'deblurDoGApply pipeline',
    layout: deblurDoGApplyPipelineLayout,
    compute: {
      module: deblurDoGApplyModule,
      entryPoint: 'computeMain',
    }
  });

  // bind 1: output texture
  const deblurDoGApplyTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });


  // configure final rendering pipeline
  const renderBindGroupLayout = device.createBindGroupLayout({
    label: "Render Bind Group Layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      }
    ]
  });

  const renderPipelineLayout = device.createPipelineLayout({
    label: "Render Pipeline Layout",
    bindGroupLayouts: [ renderBindGroupLayout ],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: renderPipelineLayout,
    vertex: {
      module: device.createShaderModule({
        code: fullscreenTexturedQuadWGSL,
      }),
      entryPoint: 'vert_main',
    },
    fragment: {
      module: device.createShaderModule({
        code: sampleExternalTextureWGSL,
      }),
      entryPoint: 'main',
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  // prepare resources for render pipeline
  // bind 0: strength uniform
  const strengthBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  function updateStrength(strength: number) {
    device.queue.writeBuffer(strengthBuffer, 0, new Float32Array([strength]));
  }

  // bind 1: sampler
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  // GUI options
  const settings = {
    requestFrame: 'requestAnimationFrame',
    shaders: 'shader 1',
    controlValue: 2,
  };

  gui.add(settings, 'requestFrame', [
    'requestAnimationFrame',
    'requestVideoFrameCallback',
  ]);

  gui.add(settings, 'shaders', [
    'shader 1',
    'shader 2'
  ]);

  gui.add(settings, 'controlValue', 0, 10, 0.1).name('Control Value').onChange((value) => {
    updateStrength(value);
  });


  function frame() {
    // fetch a new frame from video element into texture
    updateVideoFrameTexture();

    // initialize command recorder
    const commandEncoder = device.createCommandEncoder();

    // configure lumination pass
    const luminationBindGroup = device.createBindGroup({
      layout: luminationBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: imageTexture.createView(),
        },
        {
          binding: 1,
          resource: luminationTexture.createView(),
        }
      ]
    });

    // dispatch lumination pipeline
    const luminationPass = commandEncoder.beginComputePass();
    luminationPass.setPipeline(luminationPipeline);
    luminationPass.setBindGroup(0, luminationBindGroup);
    luminationPass.dispatchWorkgroups(Math.ceil(WIDTH / 8), Math.ceil(HEIGHT / 8));
    luminationPass.end();

    // configure deblurDoGX pass
    const deblurDoGXBindGroup = device.createBindGroup({
      layout: deblurDoGXBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: luminationTexture.createView(),
        },
        {
          binding: 1,
          resource: deblurDoGXTexture.createView(),
        }
      ]
    });

    // dispatch deblurDoGX pipeline
    const deblurDoGXPass = commandEncoder.beginComputePass();
    deblurDoGXPass.setPipeline(deblurDoGXPipeline);
    deblurDoGXPass.setBindGroup(0, deblurDoGXBindGroup);
    deblurDoGXPass.dispatchWorkgroups(Math.ceil(WIDTH / 8), Math.ceil(HEIGHT / 8));
    deblurDoGXPass.end();

    // configure deblurDoGY pass
    const deblurDoGYBindGroup = device.createBindGroup({
      layout: deblurDoGYBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: deblurDoGXTexture.createView(),
        },
        {
          binding: 1,
          resource: deblurDoGYTexture.createView(),
        }
      ]
    });

    // dispatch deblurDoGY pipeline
    const deblurDoGYPass = commandEncoder.beginComputePass();
    deblurDoGYPass.setPipeline(deblurDoGYPipeline);
    deblurDoGYPass.setBindGroup(0, deblurDoGYBindGroup);
    deblurDoGYPass.dispatchWorkgroups(Math.ceil(WIDTH / 8), Math.ceil(HEIGHT / 8));
    deblurDoGYPass.end();

    // configure deblurDoGApply pass
    const deblurDoGApplyBindGroup = device.createBindGroup({
      layout: deblurDoGApplyBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: deblurDoGYTexture.createView(),
        },
        {
          binding: 1,
          resource: luminationTexture.createView(),
        },
        {
          binding: 2,
          resource: imageTexture.createView(),
        },
        {
          binding: 3,
          resource: deblurDoGApplyTexture.createView(),
        },
        {
          binding: 4,
          resource: {
            buffer: strengthBuffer,
          }
        }
      ]
    });

    // dispatch deblurDoGApply pipeline
    const deblurDoGApplyPass = commandEncoder.beginComputePass();
    deblurDoGApplyPass.setPipeline(deblurDoGApplyPipeline);
    deblurDoGApplyPass.setBindGroup(0, deblurDoGApplyBindGroup);
    deblurDoGApplyPass.dispatchWorkgroups(Math.ceil(WIDTH / 8), Math.ceil(HEIGHT / 8));
    deblurDoGApplyPass.end();

    // configure render pipeline
    const renderBindGroup = device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: sampler,
        },
        {
          binding: 1,
          resource: deblurDoGApplyTexture.createView(),
        },
      ],
    });

    // dispatch render pipeline
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, renderBindGroup);
    passEncoder.draw(6);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    if (settings.requestFrame == 'requestVideoFrameCallback') {
      video.requestVideoFrameCallback(frame);
    } else {
      requestAnimationFrame(frame);
    }
  }

  if (settings.requestFrame == 'requestVideoFrameCallback') {
    video.requestVideoFrameCallback(frame);
  } else {
    requestAnimationFrame(frame);
  }
};

const VideoUploading: () => JSX.Element = () =>
  makeSample({
    name: 'WebGPU Accelerated Anime 4K Upscaling',
    description: 'This example shows how to upload video frame to WebGPU.',
    gui: true,
    init,
    filename: __filename,
  });

export default VideoUploading;
