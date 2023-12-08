/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
import {
  Anime4KPipeline, UpscaleCNN, DoG, BilateralMean,
} from 'anime4k-webgpu';

import { makeSample, SampleInit } from '../SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';

// import DeblurPipeline from '../../pipelines/DeblurDoGPipeline';
// import UpscaleCNNPipeline from '../../pipelines/UpscaleCNNPipeline';
// import DenoiseMeanPipeline from '../../pipelines/DenoiseMeanPipeline';
// import { Anime4KPipeline } from '../../pipelines/Anime4KPipeline';

type Settings = {
  requestFrame: string;
  Effects: string;
  DeblurControlValue: number;
  DenoiseControlValue: number;
  DenoiseControlValue2: number;
  comparisonEnabled: boolean;
  splitRatio: number;
};

async function configureWebGPU(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  return { device, context, presentationFormat };
}

const init: SampleInit = async ({
  canvas, pageState, gui, videoURL,
}) => {
  // Set video element
  const video = document.createElement('video');
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.src = videoURL;

  await video.play();

  const WIDTH = video.videoWidth;
  const HEIGHT = video.videoHeight;
  const { devicePixelRatio } = window;

  if (!pageState.active) return;

  const { device, context, presentationFormat } = await configureWebGPU(canvas);

  const videoFrameTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING
    | GPUTextureUsage.COPY_DST
    | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  function updateVideoFrameTexture() {
    device.queue.copyExternalImageToTexture(
      { source: video },
      { texture: videoFrameTexture },
      [WIDTH, HEIGHT],
    );
  }

  // bind 2: compare
  const compareBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // bind 4: compare split ratio
  const splitRatioBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // GUI
  let lastFrameTime = Date.now();
  let frameCount = 0;
  const fpsCounter = { fps: 0 };
  gui.add(fpsCounter, 'fps').name('FPS').listen();

  function updateFPS() {
    const now = Date.now();
    frameCount += 1;
    if (now - lastFrameTime >= 1000) {
      fpsCounter.fps = frameCount;
      frameCount = 0;
      lastFrameTime = now;
    }
  }

  const settings: Settings = {
    requestFrame: 'requestAnimationFrame',
    Effects: 'Upscale',
    DeblurControlValue: 2,
    DenoiseControlValue: 0.2,
    DenoiseControlValue2: 2,
    comparisonEnabled: false,
    splitRatio: 50,
  };

  // initial pipline mode
  let customPipeline: Anime4KPipeline;
  function updatePipeline() {
    switch (settings.Effects) {
      case 'Upscale':
        customPipeline = new UpscaleCNN(device, videoFrameTexture);
        break;
      case 'Deblur':
        customPipeline = new DoG(device, videoFrameTexture);
        customPipeline.updateParam('strength', settings.DeblurControlValue);
        break;
      case 'Denoise':
        customPipeline = new BilateralMean(device, videoFrameTexture);
        customPipeline.updateParam('strength', settings.DenoiseControlValue);
        customPipeline.updateParam('strength2', settings.DenoiseControlValue2);
        break;
      default:
        console.log('Invalid selection');
        break;
    }
  }
  updatePipeline();

  function updateCanvasSize() {
    // setting canvas dimensions
    canvas.width = customPipeline.getOutputTexture().width * devicePixelRatio;
    canvas.height = customPipeline.getOutputTexture().height * devicePixelRatio;
    canvas.style.width = `${customPipeline.getOutputTexture().width}px`;
    canvas.style.height = `${customPipeline.getOutputTexture().height}px`;
  }
  updateCanvasSize();

  gui.add(settings, 'requestFrame', ['requestAnimationFrame', 'requestVideoFrameCallback'])
    .onChange((value) => { settings.requestFrame = value; });

  const effectController = gui.add(settings, 'Effects', [
    'Upscale',
    'Deblur',
    'Denoise',
  ]);

  gui.add(settings, 'DeblurControlValue', 0.1, 15, 0.1).name('Deblur Strength').onChange((value) => {
    if (customPipeline instanceof DoG) {
      settings.DeblurControlValue = value;
      customPipeline.updateParam('strength', value);
    }
  });
  gui.add(settings, 'DenoiseControlValue', 0.1, 2, 0.1).name('Denoise Itensity Sigma').onChange((value) => {
    if (customPipeline instanceof BilateralMean) {
      settings.DenoiseControlValue = value;
      customPipeline.updateParam('strength', value);
    }
  });
  gui.add(settings, 'DenoiseControlValue2', 0.5, 10, 1).name('Denoise Spatial Sigma').onChange((value) => {
    if (customPipeline instanceof BilateralMean) {
      settings.DenoiseControlValue2 = value;
      customPipeline.updateParam('strength2', value);
    }
  });

  // Video Pause/Resume
  let isVideoPaused = false;
  gui.add({
    toggleVideo() {
      if (isVideoPaused) {
        video.play();
        isVideoPaused = false;
        console.log('Video resumed');
      } else {
        video.pause();
        isVideoPaused = true;
        console.log('Video paused');
      }
    },
  }, 'toggleVideo').name('Pause/Resume');

  // Adjust video progress
  let isUserInteracting = false;
  const videoProgress = {
    get time() {
      return video.currentTime;
    },
    set time(t) {
      if (isUserInteracting) {
        video.currentTime = t;
      }
    },
  };

  video.addEventListener('timeupdate', () => {
    if (isUserInteracting) {
      videoProgress.time = video.currentTime;
    }
  });

  gui.add(videoProgress, 'time', 0, video.duration, 0.1)
    .name('Video Progress')
    .listen()
    .onChange(() => {
      isUserInteracting = true;
      video.currentTime = videoProgress.time;
    })
    .onFinishChange(() => {
      isUserInteracting = false;
    });

  gui.add(settings, 'comparisonEnabled')
    .name('Comparison')
    .onChange((value) => {
      settings.comparisonEnabled = value;
      device.queue.writeBuffer(compareBuffer, 0, new Uint32Array([value ? 1 : 0]));
    });

  gui.add(settings, 'splitRatio', 0, 100, 0.1)
    .name('Split Ratio %')
    .onChange((value) => {
      settings.splitRatio = value;
      device.queue.writeBuffer(splitRatioBuffer, 0, new Float32Array([value / 100]));
    });

  // initial comparsion setting
  if (settings.comparisonEnabled) {
    device.queue.writeBuffer(compareBuffer, 0, new Uint32Array([1]));
  } else {
    device.queue.writeBuffer(compareBuffer, 0, new Uint32Array([0]));
  }
  device.queue.writeBuffer(splitRatioBuffer, 0, new Float32Array([settings.splitRatio / 100]));

  // configure final rendering pipeline
  const renderBindGroupLayout = device.createBindGroupLayout({
    label: 'Render Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const renderPipelineLayout = device.createPipelineLayout({
    label: 'Render Pipeline Layout',
    bindGroupLayouts: [renderBindGroupLayout],
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

  // bind 0: sampler
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  // configure render pipeline
  let renderBindGroup: GPUBindGroup;
  function updateRenderBindGroup() {
    renderBindGroup = device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: sampler,
        },
        {
          binding: 1,
          resource: customPipeline.getOutputTexture().createView(),
        },
        {
          binding: 2,
          resource: {
            buffer: compareBuffer,
          },
        },
        {
          binding: 3,
          resource: videoFrameTexture.createView(),
        },
        {
          binding: 4,
          resource: {
            buffer: splitRatioBuffer,
          },
        },
      ],
    });
  }

  updateRenderBindGroup();

  effectController.onChange((value) => {
    settings.Effects = value;
    updatePipeline();
    updateRenderBindGroup();
    updateCanvasSize();
  });

  function frame() {
    // fetch a new frame from video element into texture
    if (!video.paused) {
      // fetch a new frame from video element into texture
      updateVideoFrameTexture();
    }

    updateFPS();

    // initialize command recorder
    const commandEncoder = device.createCommandEncoder();

    // encode compute pipeline commands
    customPipeline.pass(commandEncoder);

    // dispatch render pipeline
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: {
            r: 0.0, g: 0.0, b: 0.0, a: 1.0,
          },
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

    if (settings.requestFrame === 'requestVideoFrameCallback') {
      video.requestVideoFrameCallback(frame);
    } else {
      requestAnimationFrame(frame);
    }
  }

  if (settings.requestFrame === 'requestVideoFrameCallback') {
    video.requestVideoFrameCallback(frame);
  } else {
    requestAnimationFrame(frame);
  }
};

const VideoUploading: () => JSX.Element = () => makeSample({
  name: 'WebGPU Accelerated Anime 4K Upscaling',
  description: '',
  gui: true,
  init,
  filename: __filename,
});

export default VideoUploading;
