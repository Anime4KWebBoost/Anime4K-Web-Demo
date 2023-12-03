import denoiseBilateralMeanWGSL from '../shaders/denoise/denoiseBilateralMean.wgsl';
import { Anime4KPipeline } from './Anime4KPipeline';

export default class DenoiseMeanPipeline implements Anime4KPipeline {
  texture: GPUTexture;

  module: GPUShaderModule;

  bindGroupLayout: GPUBindGroupLayout;

  bindGroup: GPUBindGroup;

  pipelineLayout: GPUPipelineLayout;

  pipeline: GPUComputePipeline;

  strengthBuffer: GPUBuffer;

  inputTexWidth: number;

  inputTexHeight: number;

  inputTexture: GPUTexture;

  // passed in by constructor
  device: GPUDevice;

  constructor(device: GPUDevice, inputTexture: GPUTexture) {
    this.device = device;
    this.inputTexWidth = inputTexture.width;
    this.inputTexHeight = inputTexture.height;
    this.inputTexture = inputTexture;

    const denoiseMeanModule = this.device.createShaderModule({
      label: 'Denoise Bilateral Mean Module',
      code: denoiseBilateralMeanWGSL,
    });

    const denoiseMeanBindGroupLayout = device.createBindGroupLayout({
      label: 'Denoise Bilateral Mean Bind Group Layout',
      entries: [{
        binding: 0, // input frame texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: 'write-only',
          format: 'rgba16float',
        },
      }],
    });

    const denoiseMeanTexture = this.device.createTexture({
      size: [this.inputTexWidth, this.inputTexHeight, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });

    const denoiseMeanBindGroup = this.device.createBindGroup({
      layout: denoiseMeanBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this.inputTexture.createView(),
        },
        {
          binding: 1,
          resource: denoiseMeanTexture.createView(),
        },
      ],
    });

    const denoisePipelineLayout = this.device.createPipelineLayout({
      label: 'Denoise Bilateral Mean Pipeline Layout',
      bindGroupLayouts: [denoiseMeanBindGroupLayout],
    });

    const denoiseMeanPipeline = device.createComputePipeline({
      label: 'Denoise Bilateral Mean Compute Pipeline',
      layout: denoisePipelineLayout,
      compute: {
        module: denoiseMeanModule,
        entryPoint: 'denoiseMain',
      },
    });

    this.texture = denoiseMeanTexture;
    this.module = denoiseMeanModule;
    this.bindGroupLayout = denoiseMeanBindGroupLayout;
    this.pipelineLayout = denoisePipelineLayout;
    this.pipeline = denoiseMeanPipeline;
    this.bindGroup = denoiseMeanBindGroup;
  }

  pass(encoder: GPUCommandEncoder) {
    const denoisePass = encoder.beginComputePass();
    denoisePass.setPipeline(this.pipeline);
    denoisePass.setBindGroup(0, this.bindGroup);
    denoisePass.dispatchWorkgroups(
      Math.ceil(this.inputTexWidth / 8),
      Math.ceil(this.inputTexHeight / 8),
    );
    denoisePass.end();
  }

  getOutputTexture(): GPUTexture {
    return this.texture;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateParam(param: string, value): void {
    throw new Error(`${this.constructor.name} has no param`);
  }
}
