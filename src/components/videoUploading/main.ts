import { makeSample, SampleInit } from '../../components/SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';

const init: SampleInit = async ({ canvas, pageState, gui, videoURL }) => {

  const settings = {
    requestFrame: 'requestAnimationFrame',
    shaders: 'shader 1',
    r: 0.0,
    g: 0.0,
    b: 0.0,
  };

  gui.add(settings, 'requestFrame', [
    'requestAnimationFrame',
    'requestVideoFrameCallback',
  ]);

  gui.add(settings, 'shaders', [
    'shader 1',
    'shader 2'
  ]);

  gui.add(settings, "r", 0.0, 1.0);
  gui.add(settings, "g", 0.0, 1.0);
  gui.add(settings, "b", 0.0, 1.0);

  // Set video element
  const video = document.createElement('video');
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.src = videoURL;
  await video.play();

  const aspectRatio = video.videoHeight / video.videoWidth;
  canvas.style.height = `calc(80vw * ${aspectRatio})`;

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  if (!pageState.active) return;

  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  const uniformArray = new Float32Array([settings.r, settings.g, settings.b, 1.0]);
  const uniformBuffer = device.createBuffer({
    label: "strength buffer",
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const bindGroupLayout = device.createBindGroupLayout({
    label: "Bind Group Layout",
    entries: [{
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {}
    }, {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      externalTexture: {}
    }, {
      binding: 3,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" }
    }]
  });

  const pipelineLayout = device.createPipelineLayout({
    label: "Pipeline Layout",
    bindGroupLayouts: [ bindGroupLayout ],
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
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

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  function frame() {
    // Sample is no longer the active page.
    if (!pageState.active) return;

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([settings.r, settings.g, settings.b, 1.0]));

    const uniformBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 1,
          resource: sampler,
        },
        {
          binding: 2,
          resource: device.importExternalTexture({
            source: video,
          }),
        },
        {
          binding: 3,
          resource:{
            buffer: uniformBuffer,
          }
        }
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
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
