import { makeSample, SampleInit } from '../../components/SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';

import DeblurPipeline from '../../pipelines/DeblurDoGPipeline';
import UpscaleCNNPipeline from '../../pipelines/UpscaleCNNPipeline';

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
  console.log(WIDTH, HEIGHT);

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

  // preparing textures for compute pipeline
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

  // const deblurPipeline = new DeblurPipeline(device, videoFrameTexture);
  const upscalePipeline = new UpscaleCNNPipeline(device, videoFrameTexture);

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

  // bind 1: sampler
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

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
        resource: upscalePipeline.getOutputTexture().createView(),
      },
    ],
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
    // deblurPipeline.updateParam("strength", value);
  });

  function frame() {
    // fetch a new frame from video element into texture
    updateVideoFrameTexture();

    // initialize command recorder
    const commandEncoder = device.createCommandEncoder();

    // encode compute pipeline commands
    upscalePipeline.pass(commandEncoder);

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
