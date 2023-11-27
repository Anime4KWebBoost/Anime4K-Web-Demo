import conv2dWGSL from '../../shaders/CNN/conv2d.wgsl'
import conv2d1WGSL from '../../shaders/CNN/conv2d1.wgsl'
import conv2d2WGSL from '../../shaders/CNN/conv2d2.wgsl'
import conv2d3WGSL from '../../shaders/CNN/conv2d3.wgsl'
import conv2d4WGSL from '../../shaders/CNN/conv2d4.wgsl'
import conv2d5WGSL from '../../shaders/CNN/conv2d5.wgsl'
import conv2d6WGSL from '../../shaders/CNN/conv2d6.wgsl'
import conv2d71WGSL from '../../shaders/CNN/conv2d71.wgsl'
import conv2d72WGSL from '../../shaders/CNN/conv2d72.wgsl'
import conv2d73WGSL from '../../shaders/CNN/conv2d73.wgsl'
import depthToSpaceWGSL from '../../shaders/CNN/depthToSpace.wgsl'
import upscaleBilinearApplyWGSL from '../../shaders/CNN/biliearApply.wgsl'

class UpscaleCNNPipeline {
  textures: GPUTexture[] = [];
  inputTexture: GPUTexture;
  modules: GPUShaderModule[] = [];
  bindGroupLayouts: GPUBindGroupLayout[] = [];
  pipelineLayouts: GPUPipelineLayout[] = [];
  pipelines: GPUComputePipeline[] = [];
  inputTexWidth: number;
  inputTexHeight: number;
  device: GPUDevice;

  constructor(device: GPUDevice, inputTexture: GPUTexture) {
    this.device = device;
    this.inputTexWidth = inputTexture.width;
    this.inputTexHeight = inputTexture.height;
    this.inputTexture = inputTexture;

    // modules
    this.modules = [
      this.device.createShaderModule({
        label: 'conv2dWGSL',
        code: conv2dWGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d1WGSL',
        code: conv2d1WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d2WGSL',
        code: conv2d2WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d3WGSL',
        code: conv2d3WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d4WGSL',
        code: conv2d4WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d5WGSL',
        code: conv2d5WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d6WGSL',
        code: conv2d6WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d71WGSL',
        code: conv2d71WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d72WGSL',
        code: conv2d72WGSL,
      }),
      this.device.createShaderModule({
        label: 'conv2d73WGSL',
        code: conv2d73WGSL,
      }),
      this.device.createShaderModule({
        label: 'depthToSpaceWGSL',
        code: depthToSpaceWGSL,
      }),
      this.device.createShaderModule({
        label: 'upscaleBilinearApplyWGSL',
        code: upscaleBilinearApplyWGSL,
      }),
    ];
    
    // bind group layouts
    this.bindGroupLayouts = [
      device.createBindGroupLayout({
        label: "4 to 4 convolution bind group layout",
        entries: [
          {
            binding: 0, // conv2d x
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 1, // conv2d x + 1
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: "rgba16float",
            },
          }
        ]
      }),
      device.createBindGroupLayout({
        label: "56 to 4 convolution bind group layout",
        entries: [
          {
            binding: 0, // conv2d
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 1, // conv2d 1
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 2, // conv2d 2
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 3, // conv2d 3
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 4, // conv2d 4
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 5, // conv2d 5
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 6, // conv2d 6
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 7, // conv2d 7 1/2/3
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: "rgba16float",
            },
          }
        ]
      }),
      device.createBindGroupLayout({
        label: "depth to space bind group layout",
        entries: [
          {
            binding: 0, // conv2d 7 - 1
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 1, // conv2d 7 - 2
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 2, // conv2d 7 - 3
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
          }
        ]
      }),
      device.createBindGroupLayout({
        label: "bilinear apply bind group layout",
        entries: [
          {
            binding: 0, // original texture
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 1, // depth to space output
            visibility: GPUShaderStage.COMPUTE,
            texture: {}
          },
          {
            binding: 2, // output texture - final
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: "rgba16float",
            },
          }
        ]
      }),
    ];

    // textures for same size cov2d layers
    for (let i = 0; i < 10; i++) {
      this.textures.push(device.createTexture({
        label: `conv2d_${i}_texture`,
        size: [this.inputTexWidth, this.inputTexHeight, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
      }));

      if (i <= 6) {
        this.pipelineLayouts.push(this.device.createPipelineLayout({
          label: `conv2d_${i} pipeline layout`,
          bindGroupLayouts: [ this.bindGroupLayouts[0] ],
        }));
        this.pipelines.push(device.createComputePipeline({
          label: `conv2d_${i} pipeline`,
          layout: this.pipelineLayouts[i],
          compute: {
            module: this.modules[i],
            entryPoint: 'computeMain',
          }
        }));
      } else {
        this.pipelineLayouts.push(this.device.createPipelineLayout({
          label: `conv2d_${i} pipeline layout`,
          bindGroupLayouts: [ this.bindGroupLayouts[1] ],
        }));
        this.pipelines.push(device.createComputePipeline({
          label: `conv2d_7_${i - 6} pipeline`,
          layout: this.pipelineLayouts[i],
          compute: {
            module: this.modules[i],
            entryPoint: 'computeMain',
          }
        }));
      }
    }
    // textures for depth to space output and final output (2x)
    for (let i of [10, 11]) {
      this.textures.push(device.createTexture({
        label: `2x_${i}_texture`,
        size: [2 * this.inputTexWidth, 2 * this.inputTexHeight, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
      }));
      if (i === 10) {
        this.pipelineLayouts.push(this.device.createPipelineLayout({
          label: `depth to space pipeline layout`,
          bindGroupLayouts: [ this.bindGroupLayouts[2] ],
        }));
        this.pipelines.push(device.createComputePipeline({
          label: `depth to space pipeline`,
          layout: this.pipelineLayouts[i],
          compute: {
            module: this.modules[i],
            entryPoint: 'computeMain',
          }
        }));
      } else {
        this.pipelineLayouts.push(this.device.createPipelineLayout({
          label: `bilinear apply pipeline layout`,
          bindGroupLayouts: [ this.bindGroupLayouts[3] ],
        }));
        this.pipelines.push(device.createComputePipeline({
          label: `biliear apply pipeline`,
          layout: this.pipelineLayouts[i],
          compute: {
            module: this.modules[i],
            entryPoint: 'computeMain',
          }
        }));
      }
    }

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
  }

  getOutputTexture() : GPUTexture {
    return this.textures[11];
  }

  generatePass(encoder: GPUCommandEncoder) {
    for (let i = 0; i <= 6; i++) {
      const bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayouts[0],
        entries: [
          {
            binding: 0,
            resource: i === 0 ? this.inputTexture.createView() : this.textures[i - 1].createView(),
          },
          {
            binding: 1,
            resource: this.textures[i].createView(),
          }
        ]
      });
      // dispatch pipeline
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipelines[i]);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 8), Math.ceil(this.inputTexHeight / 8));
      pass.end();
    }
    for (let i = 7; i <= 9; i++) {
      const bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayouts[1],
        entries: [
          {
            binding: 0,
            resource: this.textures[0].createView(),
          },
          {
            binding: 1,
            resource: this.textures[1].createView(),
          },
          {
            binding: 2,
            resource: this.textures[2].createView(),
          },
          {
            binding: 3,
            resource: this.textures[3].createView(),
          },
          {
            binding: 4,
            resource: this.textures[4].createView(),
          },
          {
            binding: 5,
            resource: this.textures[5].createView(),
          },
          {
            binding: 6,
            resource: this.textures[6].createView(),
          },
          {
            binding: 7,
            resource: this.textures[i].createView(),
          }
        ]
      });
      // dispatch pipeline
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipelines[i]);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 8), Math.ceil(this.inputTexHeight / 8));
      pass.end();
    }

    const depthToSpacebindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayouts[2],
      entries: [
        {
          binding: 0,
          resource: this.textures[7].createView(),
        },
        {
          binding: 1,
          resource: this.textures[8].createView(),
        },
        {
          binding: 2,
          resource: this.textures[9].createView(),
        },
        {
          binding: 3,
          resource: this.textures[10].createView(),
        }
      ]
    });
    // dispatch pipeline
    const depthToSpacePass = encoder.beginComputePass();
    depthToSpacePass.setPipeline(this.pipelines[10]);
    depthToSpacePass.setBindGroup(0, depthToSpacebindGroup);
    depthToSpacePass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 4), Math.ceil(this.inputTexHeight / 4));
    depthToSpacePass.end();

    const biliearApplyBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayouts[3],
      entries: [
        {
          binding: 0,
          resource: this.inputTexture.createView(),
        },
        {
          binding: 1,
          resource: this.textures[10].createView(),
        },
        {
          binding: 2,
          resource: this.textures[11].createView(),
        }
      ]
    });
    // dispatch pipeline
    const biliearPass = encoder.beginComputePass();
    biliearPass.setPipeline(this.pipelines[11]);
    biliearPass.setBindGroup(0, biliearApplyBindGroup);
    biliearPass.dispatchWorkgroups(Math.ceil(this.inputTexWidth / 4), Math.ceil(this.inputTexHeight / 4));
    biliearPass.end();
  }
};

export default UpscaleCNNPipeline;
