import luminationWGSL from '../../shaders/lumination.wgsl';
import deblurDoGXWGSL from '../../shaders/deblurDoGX.wgsl';
import deblurDoGYWGSL from '../../shaders/deblurDoGY.wgsl';
import deblurDoGApplyWGSL from '../../shaders/deblurDoGApply.wgsl';

class DeblurPipeline {
  textures: GPUTexture[];
  modules: GPUShaderModule[];
  bindGroupLayouts: GPUBindGroupLayout[];
  pipelineLayouts: GPUPipelineLayout[];
  pipelines: GPUComputePipeline[];
  strengthBuffer: GPUBuffer;
  inputTexWidth: number;
  inputTexHeight: number;
  device: GPUDevice;

  constructor(device: GPUDevice, inputTexture: GPUTexture) {
    this.device = device;
    this.inputTexWidth = inputTexture.width;
    this.inputTexHeight = inputTexture.height;

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

    // bind 1: output texture
    const luminationTexture = device.createTexture({
      size: [this.inputTexWidth, this.inputTexHeight, 1],
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
      size: [this.inputTexWidth, this.inputTexHeight, 1],
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
      size: [this.inputTexWidth, this.inputTexHeight, 1],
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
      size: [this.inputTexWidth, this.inputTexHeight, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
    });

    // gather all necessary information
    this.textures = [
      inputTexture,
      luminationTexture,
      deblurDoGXTexture,
      deblurDoGYTexture,
      deblurDoGApplyTexture,
    ];

    this.modules = [
      luminationModule,
      deblurDoGXModule,
      deblurDoGYModule,
      deblurDoGApplyModule,
    ];

    this.bindGroupLayouts = [
      luminationBindGroupLayout,
      deblurDoGXBindGroupLayout,
      deblurDoGYBindGroupLayout,
      deblurDoGApplyBindGroupLayout,
    ];

    this.pipelineLayouts = [
      luminationPipelineLayout,
      deblurDoGXPipelineLayout,
      deblurDoGYPipelineLayout,
      deblurDoGApplyPipelineLayout,
    ];

    this.pipelines = [
      luminationPipeline,
      deblurDoGXPipeline,
      deblurDoGYPipeline,
      deblurDoGApplyPipeline,
    ];

    // strength buffer
    this.strengthBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  getOutputTexture() : GPUTexture {
    return this.textures[this.textures.length - 1];
  }

  updateStrength(strength: number) {
    this.device.queue.writeBuffer(this.strengthBuffer, 0, new Float32Array([strength]));
  }

  generatePass(encoder: GPUCommandEncoder) {
    // configure lumination pass
    const luminationBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayouts[0],
      entries: [
        {
          binding: 0,
          resource: this.textures[0].createView(),
        },
        {
          binding: 1,
          resource: this.textures[1].createView(),
        }
      ]
    });

    // dispatch lumination pipeline
    const luminationPass = encoder.beginComputePass();
    luminationPass.setPipeline(this.pipelines[0]);
    luminationPass.setBindGroup(0, luminationBindGroup);
    luminationPass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 8), Math.ceil(this.inputTexHeight / 8));
    luminationPass.end();

    // configure deblurDoGX pass
    const deblurDoGXBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayouts[1],
      entries: [
        {
          binding: 0,
          resource: this.textures[1].createView(),
        },
        {
          binding: 1,
          resource: this.textures[2].createView(),
        }
      ]
    });

    // dispatch deblurDoGX pipeline
    const deblurDoGXPass = encoder.beginComputePass();
    deblurDoGXPass.setPipeline(this.pipelines[1]);
    deblurDoGXPass.setBindGroup(0, deblurDoGXBindGroup);
    deblurDoGXPass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 8), Math.ceil(this.inputTexHeight / 8));
    deblurDoGXPass.end();

    // configure deblurDoGY pass
    const deblurDoGYBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayouts[2],
      entries: [
        {
          binding: 0,
          resource: this.textures[2].createView(),
        },
        {
          binding: 1,
          resource: this.textures[3].createView(),
        }
      ]
    });

    // dispatch deblurDoGY pipeline
    const deblurDoGYPass = encoder.beginComputePass();
    deblurDoGYPass.setPipeline(this.pipelines[2]);
    deblurDoGYPass.setBindGroup(0, deblurDoGYBindGroup);
    deblurDoGYPass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 8), Math.ceil(this.inputTexHeight / 8));
    deblurDoGYPass.end();

    // configure deblurDoGApply pass
    const deblurDoGApplyBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayouts[3],
      entries: [
        {
          binding: 0,
          resource: this.textures[3].createView(),
        },
        {
          binding: 1,
          resource: this.textures[1].createView(),
        },
        {
          binding: 2,
          resource: this.textures[0].createView(),
        },
        {
          binding: 3,
          resource: this.textures[4].createView(),
        },
        {
          binding: 4,
          resource: {
            buffer: this.strengthBuffer,
          }
        }
      ]
    });

    // dispatch deblurDoGApply pipeline
    const deblurDoGApplyPass = encoder.beginComputePass();
    deblurDoGApplyPass.setPipeline(this.pipelines[3]);
    deblurDoGApplyPass.setBindGroup(0, deblurDoGApplyBindGroup);
    deblurDoGApplyPass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 8), Math.ceil(this.inputTexHeight / 8));
    deblurDoGApplyPass.end();
  }
};

export default DeblurPipeline;
