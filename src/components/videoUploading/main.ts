import { makeSample, SampleInit } from '../../components/SampleLayout';

import fullscreenTexturedQuadWGSL from '../../shaders/fullscreenTexturedQuad.wgsl';
import sampleExternalTextureWGSL from '../../shaders/sampleExternalTexture.frag.wgsl';

import DeblurPipeline from '../../pipelines/DeblurDoGPipeline';
import UpscaleCNNPipeline from '../../pipelines/UpscaleCNNPipeline';
import { Anime4KPipeline } from '../../pipelines/Anime4KPipeline';
import { GUI } from 'dat.gui';

function createFPSCounter(gui) {
  let lastFrameTime = Date.now();
  let frameCount = 0;
  const fpsCounter = { fps: 0 };
  gui.add(fpsCounter, 'fps').name('FPS').listen();

  return function updateFPS() {
    const now = Date.now();
    frameCount++;
    if (now - lastFrameTime >= 1000) {
      fpsCounter.fps = frameCount;
      frameCount = 0;
      lastFrameTime = now;
    }
  };
}

function setupGUI(gui: GUI, settings, CustomPipline: Anime4KPipeline, video: HTMLVideoElement, device: GPUDevice, compareBuffer: GPUBuffer) {
  const requestFrameController = gui.add(settings, 'requestFrame', [
    'requestAnimationFrame',
    'requestVideoFrameCallback',
  ]);

  const effectsController = gui.add(settings, 'Effects', [
    'Upscale',
    'Deblur'
  ]);

  effectsController.onChange(function(value) {
    localStorage.setItem('selectedEffect', value);
    window.location.reload();
  });

  if (settings.Effects === 'Deblur') {
    gui.add(settings, 'controlValue', 0, 50, 0.1).name('Deblur Strength').onChange((value) => {
      CustomPipline.updateParam("strength", value);
    });
  }

  //Video Pause/Resume
  let isVideoPaused = false;
  gui.add({
    toggleVideo: function() {
      if (isVideoPaused) {
        video.play();
        isVideoPaused = false;
        console.log(`Video resumed`);
      } else {
        video.pause();
        isVideoPaused = true;
        console.log(`Video paused`);
      }
    }
  }, 'toggleVideo').name('Pause/Resume');


  //Adjust video progress
  let isUserInteracting = false;
  const videoProgress = {
    get time() {
      return video.currentTime;
    },
    set time(t) {
      if (isUserInteracting) {
        video.currentTime = t;
      }
    }
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
        device.queue.writeBuffer(compareBuffer, 0, new Uint32Array([value ? 1 : 0]));
      });
}

async function configureWebGPU(canvas) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

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

  return { device, context, presentationFormat };
}

const init: SampleInit = async ({ canvas, pageState, gui, videoURL }) => {
  // Set video element
  const video = document.createElement('video');
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.src = videoURL;
  await video.play();

  let WIDTH = video.videoWidth;
  let HEIGHT = video.videoHeight;
  const aspectRatio = HEIGHT / WIDTH;
  canvas.style.height = `calc(80vw * ${aspectRatio})`;

  if (!pageState.active) return;

  const { device, context, presentationFormat } = await configureWebGPU(canvas);

  const videoFrameTexture = device.createTexture({
    size: [WIDTH, HEIGHT, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
  });

  function updateVideoFrameTexture() {
    device.queue.copyExternalImageToTexture({ source: video }, { texture: videoFrameTexture }, [WIDTH, HEIGHT]);
  }

  // bind 2: compare
  let compareBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
 
  //GUI
  const updateFPS = createFPSCounter(gui);
  const settings = {
    requestFrame: 'requestAnimationFrame',
    Effects: 'Upscale',
    controlValue: 2,
    comparisonEnabled: false,
  };
  video.addEventListener('loadedmetadata', () => {
    setupGUI(gui, settings, CustomPipline, video, device, compareBuffer);
  });

  const savedRequestFrame = localStorage.getItem('selectedRequestFrame');
  if (savedRequestFrame) settings.requestFrame = savedRequestFrame;

  const savedEffect = localStorage.getItem('selectedEffect');
  if (savedEffect) settings.Effects = savedEffect;

  var CustomPipline: Anime4KPipeline;
  switch (settings.Effects) {
    case 'Upscale':
      CustomPipline = new UpscaleCNNPipeline(device, videoFrameTexture);
      break;
    case 'Deblur':
      CustomPipline = new DeblurPipeline(device, videoFrameTexture);
      break;
    default:
      console.log("Invalid selection");
      break;
  }

  setupGUI(gui, settings, CustomPipline, video, device, compareBuffer);

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
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 3,
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

  // bind 0: sampler
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
        resource: CustomPipline.getOutputTexture().createView(), 
      },
      {
        binding: 2,
        resource: {
          buffer: compareBuffer,
        }
      },
      {
        binding: 3,
        resource: videoFrameTexture.createView(),
      }
    ],
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
    CustomPipline.pass(commandEncoder);

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
    description: 'Team: Yuanqi Wang, Tong Hu, Daniel Zhong',
    gui: true,
    init,
    filename: __filename,
  });

export default VideoUploading;
