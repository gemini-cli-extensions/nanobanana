#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ImageGenerator } from './imageGenerator.js';
import {
  ImageGenerationRequest,
  IconPromptArgs,
  PatternPromptArgs,
  DiagramPromptArgs,
} from './types.js';

class NanoBananaServer {
  private server: Server;
  private imageGenerator!: ImageGenerator;
  private initializationError: Error | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'nanobanana-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();
    this.setupErrorHandling();

    try {
      const authConfig = ImageGenerator.validateAuthentication();
      this.imageGenerator = new ImageGenerator(authConfig);
    } catch (error: unknown) {
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_image',
            description:
              'Generate single or multiple images from text prompts with style and variation options',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'The text prompt describing the image to generate',
                },
                outputCount: {
                  type: 'number',
                  description:
                    'Number of variations to generate (1-8, default: 1)',
                  minimum: 1,
                  maximum: 8,
                  default: 1,
                },
                styles: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Array of artistic styles: photorealistic, watercolor, oil-painting, sketch, pixel-art, anime, vintage, modern, abstract, minimalist',
                },
                variations: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Array of variation types: lighting, angle, color-palette, composition, mood, season, time-of-day',
                },
                format: {
                  type: 'string',
                  enum: ['grid', 'separate'],
                  description:
                    'Output format: separate files or single grid image',
                  default: 'separate',
                },
                seed: {
                  type: 'number',
                  description: 'Seed for reproducible variations',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'edit_image',
            description: 'Edit an existing image based on a text prompt',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The text prompt describing the edits to make',
                },
                file: {
                  type: 'string',
                  description: 'The filename of the input image to edit',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt', 'file'],
            },
          },
          {
            name: 'restore_image',
            description: 'Restore or enhance an existing image',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'The text prompt describing the restoration to perform',
                },
                file: {
                  type: 'string',
                  description: 'The filename of the input image to restore',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt', 'file'],
            },
          },
          {
            name: 'generate_icon',
            description:
              'Generate app icons, favicons, and UI elements in multiple sizes and formats',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'Description of the icon or UI element to generate',
                },
                sizes: {
                  type: 'array',
                  items: { type: 'number' },
                  description:
                    'Array of icon sizes in pixels (16, 32, 64, 128, 256, 512, 1024)',
                },
                type: {
                  type: 'string',
                  enum: ['app-icon', 'favicon', 'ui-element'],
                  description: 'Type of icon to generate',
                  default: 'app-icon',
                },
                style: {
                  type: 'string',
                  enum: ['flat', 'skeuomorphic', 'minimal', 'modern'],
                  description: 'Visual style of the icon',
                  default: 'modern',
                },
                format: {
                  type: 'string',
                  enum: ['png', 'jpeg'],
                  description: 'Output format',
                  default: 'png',
                },
                background: {
                  type: 'string',
                  description:
                    'Background type: transparent, white, black, or color name',
                  default: 'transparent',
                },
                corners: {
                  type: 'string',
                  enum: ['rounded', 'sharp'],
                  description: 'Corner style for app icons',
                  default: 'rounded',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'generate_pattern',
            description:
              'Generate seamless patterns and textures for backgrounds and design elements',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'Description of the pattern or texture to generate',
                },
                size: {
                  type: 'string',
                  description: 'Pattern tile size (e.g., "256x256", "512x512")',
                  default: '256x256',
                },
                type: {
                  type: 'string',
                  enum: ['seamless', 'texture', 'wallpaper'],
                  description: 'Type of pattern to generate',
                  default: 'seamless',
                },
                style: {
                  type: 'string',
                  enum: ['geometric', 'organic', 'abstract', 'floral', 'tech'],
                  description: 'Pattern style',
                  default: 'abstract',
                },
                density: {
                  type: 'string',
                  enum: ['sparse', 'medium', 'dense'],
                  description: 'Element density in the pattern',
                  default: 'medium',
                },
                colors: {
                  type: 'string',
                  enum: ['mono', 'duotone', 'colorful'],
                  description: 'Color scheme',
                  default: 'colorful',
                },
                repeat: {
                  type: 'string',
                  enum: ['tile', 'mirror'],
                  description: 'Tiling method for seamless patterns',
                  default: 'tile',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'generate_story',
            description:
              'Generate a sequence of related images that tell a visual story or show a process',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'Description of the story or process to visualize',
                },
                steps: {
                  type: 'number',
                  description: 'Number of sequential images to generate (2-8)',
                  minimum: 2,
                  maximum: 8,
                  default: 4,
                },
                type: {
                  type: 'string',
                  enum: ['story', 'process', 'tutorial', 'timeline'],
                  description: 'Type of sequence to generate',
                  default: 'story',
                },
                style: {
                  type: 'string',
                  enum: ['consistent', 'evolving'],
                  description: 'Visual consistency across frames',
                  default: 'consistent',
                },
                layout: {
                  type: 'string',
                  enum: ['separate', 'grid', 'comic'],
                  description: 'Output layout format',
                  default: 'separate',
                },
                transition: {
                  type: 'string',
                  enum: ['smooth', 'dramatic', 'fade'],
                  description: 'Transition style between steps',
                  default: 'smooth',
                },
                format: {
                  type: 'string',
                  enum: ['storyboard', 'individual'],
                  description: 'Output format',
                  default: 'individual',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'generate_diagram',
            description:
              'Generate technical diagrams, flowcharts, and architectural mockups',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'Description of the diagram content and structure',
                },
                type: {
                  type: 'string',
                  enum: [
                    'flowchart',
                    'architecture',
                    'network',
                    'database',
                    'wireframe',
                    'mindmap',
                    'sequence',
                  ],
                  description: 'Type of diagram to generate',
                  default: 'flowchart',
                },
                style: {
                  type: 'string',
                  enum: ['professional', 'clean', 'hand-drawn', 'technical'],
                  description: 'Visual style of the diagram',
                  default: 'professional',
                },
                layout: {
                  type: 'string',
                  enum: ['horizontal', 'vertical', 'hierarchical', 'circular'],
                  description: 'Layout orientation',
                  default: 'hierarchical',
                },
                complexity: {
                  type: 'string',
                  enum: ['simple', 'detailed', 'comprehensive'],
                  description: 'Level of detail in the diagram',
                  default: 'detailed',
                },
                colors: {
                  type: 'string',
                  enum: ['mono', 'accent', 'categorical'],
                  description: 'Color scheme',
                  default: 'accent',
                },
                annotations: {
                  type: 'string',
                  enum: ['minimal', 'detailed'],
                  description: 'Label and annotation level',
                  default: 'detailed',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated images in default viewer',
                  default: false,
                },
              },
              required: ['prompt'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (this.initializationError) {
        throw this.initializationError;
      }

      const { name, arguments: args } = request.params;

      try {
        let response;

        switch (name) {
          case 'generate_image': {
            const imageRequest: ImageGenerationRequest = {
              prompt: args?.prompt as string,
              outputCount: (args?.outputCount as number) || 1,
              mode: 'generate',
              styles: args?.styles as string[],
              variations: args?.variations as string[],
              format: (args?.format as 'grid' | 'separate') || 'separate',
              seed: args?.seed as number,
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response =
              await this.imageGenerator.generateTextToImage(imageRequest);
            break;
          }

          case 'edit_image': {
            const editRequest: ImageGenerationRequest = {
              prompt: args?.prompt as string,
              inputImage: args?.file as string,
              mode: 'edit',
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response = await this.imageGenerator.editImage(editRequest);
            break;
          }

          case 'restore_image': {
            const restoreRequest: ImageGenerationRequest = {
              prompt: args?.prompt as string,
              inputImage: args?.file as string,
              mode: 'restore',
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response = await this.imageGenerator.editImage(restoreRequest);
            break;
          }

          case 'generate_icon': {
            const iconRequest: ImageGenerationRequest = {
              prompt: this.buildIconPrompt(args),
              outputCount: (args?.sizes as number[])?.length || 1,
              mode: 'generate',
              fileFormat: (args?.format as 'png' | 'jpeg') || 'png',
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response =
              await this.imageGenerator.generateTextToImage(iconRequest);
            break;
          }

          case 'generate_pattern': {
            const patternRequest: ImageGenerationRequest = {
              prompt: this.buildPatternPrompt(args),
              outputCount: 1,
              mode: 'generate',
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response =
              await this.imageGenerator.generateTextToImage(patternRequest);
            break;
          }

          case 'generate_story': {
            const storyRequest: ImageGenerationRequest = {
              prompt: args?.prompt as string,
              outputCount: (args?.steps as number) || 4,
              mode: 'generate',
              variations: ['sequence-step'],
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response = await this.imageGenerator.generateStorySequence(
              storyRequest,
              args,
            );
            break;
          }

          case 'generate_diagram': {
            const diagramRequest: ImageGenerationRequest = {
              prompt: this.buildDiagramPrompt(args),
              outputCount: 1,
              mode: 'generate',
              preview: args?.preview as boolean,
              noPreview:
                (args?.noPreview as boolean) ||
                (args?.['no-preview'] as boolean),
            };
            response =
              await this.imageGenerator.generateTextToImage(diagramRequest);
            break;
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        if (response.success) {
          return {
            content: [
              {
                type: 'text',
                text: `${response.message}\n\nGenerated files:\n${response.generatedFiles?.map((f) => `• ${f}`).join('\n') || 'None'}`, 
              },
            ],
          };
        } else {
          throw new Error(response.error || response.message);
        }
      } catch (error: unknown) {
        console.error(`Error executing tool ${name}:`, error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`An unexpected error occurred: ${String(error)}`);
      }
    });
  }

  private buildIconPrompt(args?: IconPromptArgs): string {
    const basePrompt = args?.prompt || 'app icon';
    const type = args?.type || 'app-icon';
    const style = args?.style || 'modern';
    const background = args?.background || 'transparent';
    const corners = args?.corners || 'rounded';

    let prompt = `${basePrompt}, ${style} style ${type}`;

    if (type === 'app-icon') {
      prompt += `, ${corners} corners`;
    }

    if (background !== 'transparent') {
      prompt += `, ${background} background`;
    }

    prompt += ', clean design, high quality, professional';

    return prompt;
  }

  private buildPatternPrompt(args?: PatternPromptArgs): string {
    const basePrompt = args?.prompt || 'abstract pattern';
    const type = args?.type || 'seamless';
    const style = args?.style || 'abstract';
    const density = args?.density || 'medium';
    const colors = args?.colors || 'colorful';
    const size = args?.size || '256x256';

    let prompt = `${basePrompt}, ${style} style ${type} pattern, ${density} density, ${colors} colors`;

    if (type === 'seamless') {
      prompt += ', tileable, repeating pattern';
    }

    prompt += `, ${size} tile size, high quality`;

    return prompt;
  }

  private buildDiagramPrompt(args?: DiagramPromptArgs): string {
    const basePrompt = args?.prompt || 'system diagram';
    const type = args?.type || 'flowchart';
    const style = args?.style || 'professional';
    const layout = args?.layout || 'hierarchical';
    const complexity = args?.complexity || 'detailed';
    const colors = args?.colors || 'accent';
    const annotations = args?.annotations || 'detailed';

    let prompt = `${basePrompt}, ${type} diagram, ${style} style, ${layout} layout`;
    prompt += `, ${complexity} level of detail, ${colors} color scheme`;
    prompt += `, ${annotations} annotations and labels`;
    prompt += ', clean technical illustration, clear visual hierarchy';

    return prompt;
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Nano Banana MCP server running on stdio');
  }
}

const server = new NanoBananaServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
