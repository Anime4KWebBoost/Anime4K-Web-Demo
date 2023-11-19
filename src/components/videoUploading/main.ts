import { makeSample, SampleInit } from '../../components/SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';

const init: SampleInit = async ({ canvas, pageState, gui, videoURL }) => {
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

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
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

  //test texture
  const imgBitmap = await createImageBitmap(await (await fetch('https://webgpufundamentals.org/webgpu/resources/images/f-texture.png')).blob());
  const texture = device.createTexture({
    size: [imgBitmap.width, imgBitmap.height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: imgBitmap }, { texture }, [imgBitmap.width, imgBitmap.height]);

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const settings = {
    requestFrame: 'requestAnimationFrame',
    shaders: 'shader 1',
    controlValue: 2,
  };

  const strengthBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  gui.add(settings, 'requestFrame', [
    'requestAnimationFrame',
    'requestVideoFrameCallback',
  ]);

  gui.add(settings, 'shaders', [
    'shader 1',
    'shader 2'
  ]);
  gui.add(settings, 'controlValue', 0, 10, 1).name('Control Value').onChange((value) => {
    device.queue.writeBuffer(strengthBuffer, 0, new Float32Array([value]));
  });

  function frame() {
    // Sample is no longer the active page.
    if (!pageState.active) return;

    const uniformBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        
        {
          binding: 1,
          resource: sampler,
        },
        {
          binding: 2,
          resource: texture.createView(),
        },
        // {
        //   binding: 3, // For _Strength
        //   resource: {
        //     buffer: strengthBuffer,
        //   },
        // },
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
