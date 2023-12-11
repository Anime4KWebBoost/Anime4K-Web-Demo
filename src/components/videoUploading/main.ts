/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
import {
  Anime4KPipeline, // Interface
  // original
  Original,
  // deblur
  DoG,
  // denoise
  BilateralMean,
  // Upscale
  GANx3L,
  CNNx2UL,
  GANx4UUL,
  // Restore
  CNNUL,
  GANUUL,
} from 'anime4k-webgpu';

import { makeSample, SampleInit } from '../SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';

type Settings = {
  requestFrame: string;
  effect: string;
  deblurCoef: number;
  denoiseCoef: number;
  denoiseCoef2: number;
  compareOn: boolean;
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
  canvas, pageState, gui, videoURL, stats, imageURL,
}) => {
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  // Set video element
  const video = document.createElement('video');
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.src = videoURL;

  await video.play();

  let imgBitmap = null;
  if (imageURL) {
    // Texture logic
    imgBitmap = await createImageBitmap(await (await fetch(imageURL)).blob());
  }

  const WIDTH = video.videoWidth;
  const HEIGHT = video.videoHeight;
  const { devicePixelRatio } = window;

  if (!pageState.active) return;

  const { device, context, presentationFormat } = await configureWebGPU(canvas);

  let videoFrameTexture: GPUTexture;
  if (imageURL) {
    videoFrameTexture = device.createTexture({
      size: [imgBitmap.width, imgBitmap.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.RENDER_ATTACHMENT,
    });
  } else {
    videoFrameTexture = device.createTexture({
      size: [WIDTH, HEIGHT, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  function updateVideoFrameTexture() {
    if (imageURL) {
      device.queue.copyExternalImageToTexture(
        { source: imgBitmap },
        { texture: videoFrameTexture },
        [imgBitmap.width, imgBitmap.height],
      );
    } else {
      device.queue.copyExternalImageToTexture(
        { source: video },
        { texture: videoFrameTexture },
        [WIDTH, HEIGHT],
      );
    }
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
  // let lastFrameTime = Date.now();
  // let frameCount = 0;
  // const fpsCounter = { fps: 0 };
  // gui.add(fpsCounter, 'fps').name('FPS').listen();

  // function updateFPS() {
  //   const now = Date.now();
  //   frameCount += 1;
  //   if (now - lastFrameTime >= 1000) {
  //     fpsCounter.fps = frameCount;
  //     frameCount = 0;
  //     lastFrameTime = now;
  //   }
  // }

  const settings: Settings = {
    requestFrame: 'requestVideoFrameCallback',
    effect: 'Original',
    deblurCoef: 2,
    denoiseCoef: 0.2,
    denoiseCoef2: 2,
    compareOn: false,
    splitRatio: 50,
  };

  // initial pipline mode
  let customPipeline: Anime4KPipeline;
  function updatePipeline() {
    switch (settings.effect) {
      case 'Original':
        customPipeline = new Original(videoFrameTexture);
        break;
      case 'Deblur-DoG':
        customPipeline = new DoG(device, videoFrameTexture);
        try {
          customPipeline.updateParam('strength', settings.deblurCoef);
        } catch (e) {
          console.log(e);
        }
        break;
      case 'Denoise-BilateralMean':
        customPipeline = new BilateralMean(device, videoFrameTexture);
        try {
          customPipeline.updateParam('strength', settings.denoiseCoef);
          customPipeline.updateParam('strength2', settings.denoiseCoef2);
        } catch (e) {
          console.log(e);
        }
        break;
      // Upscale
      case 'Upscale-GANx3L':
        customPipeline = new GANx3L(device, videoFrameTexture);
        break;
      case 'Upscale-CNNx2UL':
        customPipeline = new CNNx2UL(device, videoFrameTexture);
        break;
      case 'Upscale-GANx4UUL':
        customPipeline = new GANx4UUL(device, videoFrameTexture);
        break;
      // Restore
      case 'Restore-CNNUL':
        customPipeline = new CNNUL(device, videoFrameTexture);
        break;
      case 'Restore-GANUUL':
        customPipeline = new GANUUL(device, videoFrameTexture);
        break;
      default:
        console.log('Invalid selection');
        break;
    }
  }
  updatePipeline();

  function updateCanvasSize() {
    // setting canvas dimensions
    canvas.width = customPipeline.getOutputTexture().width;
    canvas.height = customPipeline.getOutputTexture().height;
    canvas.style.width = `${customPipeline.getOutputTexture().width}px`;
    canvas.style.height = `${customPipeline.getOutputTexture().height}px`;
  }
  updateCanvasSize();

  for (const folder in gui.__folders) {
    gui.removeFolder(gui.__folders[folder]);
  }
  while (gui.__controllers.length > 0) {
    gui.__controllers[0].remove();
  }
  const generalFolder = gui.addFolder('General');
  // if (!imageURL) {
  //   generalFolder.add(
  //     settings,
  //     'requestFrame',
  //     ['requestAnimationFrame', 'requestVideoFrameCallback'],
  //   )
  //     .name('Request Frame');
  // }
  const effectController = generalFolder.add(
    settings,
    'effect',
    [
      'Original',
      'Deblur-DoG',
      'Denoise-BilateralMean',
      // Upscale
      'Upscale-GANx3L',
      'Upscale-CNNx2UL',
      'Upscale-GANx4UUL',
      // Restore
      'Restore-CNNUL',
      'Restore-GANUUL',
    ],
  )
    .name('Effect');

  function downloadCanvasAsImage() {
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('download', 'CanvasImage.png');
    console.log('download canvas of size', canvas.width, canvas.height);

    // Convert canvas content to data URL
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.setAttribute('href', url);
      downloadLink.click();
    }, 'image/png');
  }

  generalFolder.add({ downloadCanvasAsImage }, 'downloadCanvasAsImage').name('Download Canvas');

  // Effect Settings
  const deblurFolder = gui.addFolder('Deblur');
  deblurFolder.add(settings, 'deblurCoef', 0.1, 15, 0.1).name('Strength').onChange((value) => {
    try {
      customPipeline.updateParam('strength', value);
      oneFrame();
    } catch (e) {
      console.log(e);
    }
  });
  const denoiseFolder = gui.addFolder('Denoise');
  denoiseFolder.add(settings, 'denoiseCoef', 0.1, 2, 0.1).name('Itensity Sigma').onChange((value) => {
    try {
      customPipeline.updateParam('strength', value);
      oneFrame();
    } catch (e) {
      console.log(e);
    }
  });
  denoiseFolder.add(settings, 'denoiseCoef2', 0.5, 10, 1).name('Spatial Sigma').onChange((value) => {
    try {
      customPipeline.updateParam('strength2', value);
      oneFrame();
    } catch (e) {
      console.log(e);
    }
  });

  // Video Pause/Resume
  let isVideoPaused = false;
  if (!imageURL) {
    generalFolder.add({
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
  }

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

  if (!imageURL) {
    generalFolder.add(videoProgress, 'time', 0, video.duration, 0.1)
      .name('Video Progress')
      .listen()
      .onChange(() => {
        isUserInteracting = true;
        video.currentTime = videoProgress.time;
      })
      .onFinishChange(() => {
        isUserInteracting = false;
      });
  }

  generalFolder.add(settings, 'compareOn')
    .name('Comparison')
    .onChange((value) => {
      device.queue.writeBuffer(compareBuffer, 0, new Uint32Array([value ? 1 : 0]));
      oneFrame();
    });
  generalFolder.add(settings, 'splitRatio', 0, 100, 0.1)
    .name('Split Line%')
    .onChange((value) => {
      device.queue.writeBuffer(splitRatioBuffer, 0, new Float32Array([value / 100]));
      oneFrame();
    });

  // initial comparsion setting
  if (settings.compareOn) {
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
    // settings.effect = value;
    updatePipeline();
    updateRenderBindGroup();
    updateCanvasSize();
    oneFrame();
  });

  for (const folder in gui.__folders) {
    gui.__folders[folder].open();
  }

  function oneFrame() {
    if (!video.paused) {
      return;
    }
    updateVideoFrameTexture();
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
  }

  function frame() {
    stats.begin();
    // fetch a new frame from video element into texture
    if (!video.paused) {
      // fetch a new frame from video element into texture
      updateVideoFrameTexture();
    }

    // updateFPS();

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
    stats.end();

    // if (imageURL) {
    //   return;
    // }

    // if (settings.requestFrame === 'requestVideoFrameCallback') {
    video.requestVideoFrameCallback(frame);
    //   console.log('requestVideoFrameCallback');
    // } else {
    // requestAnimationFrame(frame);
    //   console.log('requestAnimationFrame');
    // }
  }

  // if (settings.requestFrame === 'requestVideoFrameCallback') {
  video.requestVideoFrameCallback(frame);
  // } else {
  // requestAnimationFrame(frame);
  // }

  // if (imageURL) {
  //   frame();
  //   return;
  // }

  const destroy = () => {
    video.pause();
    video.src = '';
    video.load();
    imageURL = 'something';
    for (const folder in gui.__folders) {
      gui.removeFolder(gui.__folders[folder]);
    }
    console.log('previous loop destroyed');
  };

  return destroy;
};

const VideoUploading: () => JSX.Element = () => makeSample({
  name: 'WebGPU Accelerated Anime4K',
  description: '',
  gui: true,
  init,
  filename: __filename,
});

export default VideoUploading;
