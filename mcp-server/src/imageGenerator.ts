/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { FileHandler } from './fileHandler.js';
import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  AuthConfig,
  StorySequenceArgs,
} from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ImageGenerator {
  private ai: GoogleGenAI;
  private static readonly MODEL_NAME = 'gemini-2.5-flash-image';

  constructor(authConfig: AuthConfig) {
    this.ai = new GoogleGenAI({
      apiKey: authConfig.apiKey,
    });
  }

  private async openImagePreview(filePath: string): Promise<void> {
    try {
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'darwin': // macOS
          command = `open "${filePath}"`;
          break;
        case 'win32': // Windows
          command = `start "" "${filePath}"`;
          break;
        default: // Linux and others
          command = `xdg-open "${filePath}"`;
          break;
      }

      await execAsync(command);
      console.error(`DEBUG - Opened preview for: ${filePath}`);
    } catch (error: unknown) {
      console.error(
        `DEBUG - Failed to open preview for ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      // Don't throw - preview failure shouldn't break image generation
    }
  }

  private shouldAutoPreview(request: ImageGenerationRequest): boolean {
    // If --no-preview is explicitly set, never preview
    if (request.noPreview) {
      return false;
    }

    // Only preview when --preview flag is explicitly set
    if (request.preview) {
      return true;
    }

    // No auto-preview - images only open when explicitly requested
    return false;
  }

  private async handlePreview(
    files: string[],
    request: ImageGenerationRequest,
  ): Promise<void> {
    const shouldPreview = this.shouldAutoPreview(request);

    if (!shouldPreview || !files.length) {
      if (files.length > 1 && request.noPreview) {
        console.error(
          `DEBUG - Auto-preview disabled for ${files.length} images (--no-preview specified)`,
        );
      }
      return;
    }

    console.error(
      `DEBUG - ${request.preview ? 'Explicit' : 'Auto'}-opening ${files.length} image(s) for preview`,
    );

    // Open all generated images
    const previewPromises = files.map((file) => this.openImagePreview(file));
    await Promise.all(previewPromises);
  }

  static validateAuthentication(): AuthConfig {
    const nanoGeminiKey = process.env.NANOBANANA_GEMINI_API_KEY;
    if (nanoGeminiKey) {
      console.error('✓ Found NANOBANANA_GEMINI_API_KEY environment variable');
      return { apiKey: nanoGeminiKey, keyType: 'GEMINI_API_KEY' };
    }

    const nanoGoogleKey = process.env.NANOBANANA_GOOGLE_API_KEY;
    if (nanoGoogleKey) {
      console.error('✓ Found NANOBANANA_GOOGLE_API_KEY environment variable');
      return { apiKey: nanoGoogleKey, keyType: 'GOOGLE_API_KEY' };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      console.error(
        '✓ Found GEMINI_API_KEY environment variable (fallback)',
      );
      return { apiKey: geminiKey, keyType: 'GEMINI_API_KEY' };
    }

    const googleKey = process.env.GOOGLE_API_KEY;
    if (googleKey) {
      console.error(
        '✓ Found GOOGLE_API_KEY environment variable (fallback)',
      );
      return { apiKey: googleKey, keyType: 'GOOGLE_API_KEY' };
    }

    throw new Error(
      'ERROR: No valid API key found. Please set NANOBANANA_GEMINI_API_KEY, NANOBANANA_GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY environment variable.\n' +
        'For more details on authentication, visit: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/authentication.md',
    );
  }

  private isValidBase64ImageData(data: string): boolean {
    // Check if data looks like base64 image data
    if (!data || data.length < 100) {
      return false; // Too short to be meaningful image data
    }

    // Check if it's valid base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) {
      return false; // Not valid base64
    }

    // Additional check: base64 image data is typically quite long
    if (data.length < 1000) {
      console.error(
        'DEBUG - Skipping short data that may not be image:',
        data.length,
        'characters',
      );
      return false;
    }

    return true;
  }

  private buildBatchPrompts(request: ImageGenerationRequest): string[] {
    const prompts: string[] = [];
    const basePrompt = request.prompt;

    // If no batch options, return original prompt
    if (!request.styles && !request.variations && !request.outputCount) {
      return [basePrompt];
    }

    // Handle styles
    if (request.styles && request.styles.length > 0) {
      for (const style of request.styles) {
        prompts.push(`${basePrompt}, ${style} style`);
      }
    }

    // Handle variations
    if (request.variations && request.variations.length > 0) {
      const basePrompts = prompts.length > 0 ? prompts : [basePrompt];
      const variationPrompts: string[] = [];

      for (const baseP of basePrompts) {
        for (const variation of request.variations) {
          switch (variation) {
            case 'lighting':
              variationPrompts.push(`${baseP}, dramatic lighting`);
              variationPrompts.push(`${baseP}, soft lighting`);
              break;
            case 'angle':
              variationPrompts.push(`${baseP}, from above`);
              variationPrompts.push(`${baseP}, close-up view`);
              break;
            case 'color-palette':
              variationPrompts.push(`${baseP}, warm color palette`);
              variationPrompts.push(`${baseP}, cool color palette`);
              break;
            case 'composition':
              variationPrompts.push(`${baseP}, centered composition`);
              variationPrompts.push(`${baseP}, rule of thirds composition`);
              break;
            case 'mood':
              variationPrompts.push(`${baseP}, cheerful mood`);
              variationPrompts.push(`${baseP}, dramatic mood`);
              break;
            case 'season':
              variationPrompts.push(`${baseP}, in spring`);
              variationPrompts.push(`${baseP}, in winter`);
              break;
            case 'time-of-day':
              variationPrompts.push(`${baseP}, at sunrise`);
              variationPrompts.push(`${baseP}, at sunset`);
              break;
          }
        }
      }
      if (variationPrompts.length > 0) {
        prompts.splice(0, prompts.length, ...variationPrompts);
      }
    }

    // If no styles/variations but outputCount > 1, create simple variations
    if (
      prompts.length === 0 &&
      request.outputCount &&
      request.outputCount > 1
    ) {
      for (let i = 0; i < request.outputCount; i++) {
        prompts.push(basePrompt);
      }
    }

    // Limit to outputCount if specified
    if (request.outputCount && prompts.length > request.outputCount) {
      prompts.splice(request.outputCount);
    }

    return prompts.length > 0 ? prompts : [basePrompt];
  }

  async generateTextToImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    try {
      const outputPath = FileHandler.ensureOutputDirectory();
      const generatedFiles: string[] = [];
      const prompts = this.buildBatchPrompts(request);

      console.error(`DEBUG - Generating ${prompts.length} image variation(s)`);

      for (let i = 0; i < prompts.length; i++) {
        const currentPrompt = prompts[i];
        console.error(
          `DEBUG - Generating variation ${i + 1}/${prompts.length}:`,
          currentPrompt,
        );

        try {
          // Make API call for each variation
          const response = await this.ai.models.generateContent({
            model: ImageGenerator.MODEL_NAME,
            contents: [
              {
                role: 'user',
                parts: [{ text: currentPrompt }],
              },
            ],
          });

          console.error('DEBUG - API Response structure for variation', i + 1);

          if (response.candidates && response.candidates[0]?.content?.parts) {
            // Process image parts in the response
            for (const part of response.candidates[0].content.parts) {
              let imageBase64: string | undefined;

              if (part.inlineData?.data) {
                imageBase64 = part.inlineData.data;
                console.error('DEBUG - Found image data in inlineData:', {
                  length: imageBase64.length,
                  mimeType: part.inlineData.mimeType,
                });
              } else if (part.text && this.isValidBase64ImageData(part.text)) {
                imageBase64 = part.text;
                console.error(
                  'DEBUG - Found image data in text field (fallback)',
                );
              }

              if (imageBase64) {
                const filename = FileHandler.generateFilename(
                  request.styles || request.variations
                    ? currentPrompt
                    : request.prompt,
                  request.fileFormat,
                  i,
                );
                const fullPath = await FileHandler.saveImageFromBase64(
                  imageBase64,
                  outputPath,
                  filename,
                );
                generatedFiles.push(fullPath);
                console.error('DEBUG - Image saved to:', fullPath);
                break; // Only process first valid image per variation
              }
            }
          }
        } catch (error: unknown) {
          console.error(
            `DEBUG - Error generating variation ${i + 1}:`,
            error instanceof Error ? error.message : String(error),
          );
          // Continue with other variations even if one fails
        }
      }

      if (generatedFiles.length === 0) {
        return {
          success: false,
          message: 'Failed to generate any images',
          error: 'No image data found in API responses',
        };
      }

      // Handle preview if requested
      await this.handlePreview(generatedFiles, request);

      return {
        success: true,
        message: `Successfully generated ${generatedFiles.length} image variation(s)`,
        generatedFiles,
      };
    } catch (error: unknown) {
      console.error('DEBUG - Error in generateTextToImage:', error);
      return {
        success: false,
        message: 'Failed to generate image',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async generateStorySequence(
    request: ImageGenerationRequest,
    args?: StorySequenceArgs,
  ): Promise<ImageGenerationResponse> {
    try {
      const outputPath = FileHandler.ensureOutputDirectory();
      const generatedFiles: string[] = [];
      const steps = request.outputCount || 4;
      const type = args?.type || 'story';
      const style = args?.style || 'consistent';
      const transition = args?.transition || 'smooth';

      console.error(`DEBUG - Generating ${steps}-step ${type} sequence`);

      // Generate each step of the story/process
      for (let i = 0; i < steps; i++) {
        const stepNumber = i + 1;
        let stepPrompt = `${request.prompt}, step ${stepNumber} of ${steps}`;

        // Add context based on type
        switch (type) {
          case 'story':
            stepPrompt += `, narrative sequence, ${style} art style`;
            break;
          case 'process':
            stepPrompt += `, procedural step, instructional illustration`;
            break;
          case 'tutorial':
            stepPrompt += `, tutorial step, educational diagram`;
            break;
          case 'timeline':
            stepPrompt += `, chronological progression, timeline visualization`;
            break;
        }

        // Add transition context
        if (i > 0) {
          stepPrompt += `, ${transition} transition from previous step`;
        }

        console.error(`DEBUG - Generating step ${stepNumber}: ${stepPrompt}`);

        try {
          const response = await this.ai.models.generateContent({
            model: ImageGenerator.MODEL_NAME,
            contents: [
              {
                role: 'user',
                parts: [{ text: stepPrompt }],
              },
            ],
          });

          if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              let imageBase64: string | undefined;

              if (part.inlineData?.data) {
                imageBase64 = part.inlineData.data;
              } else if (part.text && this.isValidBase64ImageData(part.text)) {
                imageBase64 = part.text;
              }

              if (imageBase64) {
                const filename = FileHandler.generateFilename(
                  `${type}step${stepNumber}${request.prompt}`,
                  'png', // Stories default to png
                  0,
                );
                const fullPath = await FileHandler.saveImageFromBase64(
                  imageBase64,
                  outputPath,
                  filename,
                );
                generatedFiles.push(fullPath);
                console.error(`DEBUG - Step ${stepNumber} saved to:`, fullPath);
                break;
              }
            }
          }
        } catch (error: unknown) {
          console.error(
            `DEBUG - Error generating step ${stepNumber}:`,
            error instanceof Error ? error.message : String(error),
          );
          console.error(`DEBUG - Full error details:`, error);
          // Continue with other steps even if one fails
        }

        // Check if this step was actually generated
        if (generatedFiles.length < stepNumber) {
          console.error(
            `DEBUG - WARNING: Step ${stepNumber} failed to generate - no valid image data received`,
          );
        }
      }

      console.error(
        `DEBUG - Story generation completed. Generated ${generatedFiles.length} out of ${steps} requested images`,
      );

      if (generatedFiles.length === 0) {
        return {
          success: false,
          message: 'Failed to generate any story sequence images',
          error: 'No image data found in API responses',
        };
      }

      // Handle preview if requested
      await this.handlePreview(generatedFiles, request);

      const wasFullySuccessful = generatedFiles.length === steps;
      const successMessage = wasFullySuccessful
        ? `Successfully generated complete ${steps}-step ${type} sequence`
        : `Generated ${generatedFiles.length} out of ${steps} requested ${type} steps (${steps - generatedFiles.length} steps failed)`;

      return {
        success: true,
        message: successMessage,
        generatedFiles,
      };
    } catch (error: unknown) {
      console.error('DEBUG - Error in generateStorySequence:', error);
      return {
        success: false,
        message: `Failed to generate ${request.mode} sequence`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async editImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    try {
      if (!request.inputImage) {
        return {
          success: false,
          message: 'Input image file is required for editing',
          error: 'Missing inputImage parameter',
        };
      }

      const fileResult = FileHandler.findInputFile(request.inputImage);
      if (!fileResult.found) {
        return {
          success: false,
          message: `Input image not found: ${request.inputImage}`,
          error: `Searched in: ${fileResult.searchedPaths.join(', ')}`,
        };
      }

      const outputPath = FileHandler.ensureOutputDirectory();
      const imageBase64 = await FileHandler.readImageAsBase64(
        fileResult.filePath!,
      );

      const response = await this.ai.models.generateContent({
        model: ImageGenerator.MODEL_NAME,
        contents: [
          {
            role: 'user',
            parts: [
              { text: request.prompt },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: 'image/png',
                },
              },
            ],
          },
        ],
      });

      console.error(
        'DEBUG - Edit API Response structure:',
        JSON.stringify(response, null, 2),
      );

      if (response.candidates && response.candidates[0]?.content?.parts) {
        const generatedFiles: string[] = [];
        let imageFound = false;

        for (const part of response.candidates[0].content.parts) {
          let resultImageBase64: string | undefined;

          if (part.inlineData?.data) {
            resultImageBase64 = part.inlineData.data;
            console.error('DEBUG - Found edited image in inlineData:', {
              length: resultImageBase64.length,
              mimeType: part.inlineData.mimeType,
            });
          } else if (part.text && this.isValidBase64ImageData(part.text)) {
            resultImageBase64 = part.text;
            console.error(
              'DEBUG - Found edited image in text field (fallback)',
            );
          }

          if (resultImageBase64) {
            const filename = FileHandler.generateFilename(
              `${request.mode}_${request.prompt}`,
              'png', // Edits default to png
              0,
            );
            const fullPath = await FileHandler.saveImageFromBase64(
              resultImageBase64,
              outputPath,
              filename,
            );
            generatedFiles.push(fullPath);
            console.error('DEBUG - Edited image saved to:', fullPath);
            imageFound = true;
            break; // Only process the first valid image
          }
        }

        if (!imageFound) {
          console.error(
            'DEBUG - No valid image data found in edit response parts',
          );
        }

        // Handle preview if requested
        await this.handlePreview(generatedFiles, request);

        return {
          success: true,
          message: `Successfully ${request.mode}d image`,
          generatedFiles,
        };
      }

      return {
        success: false,
        message: `Failed to ${request.mode} image`,
        error: 'No image data in response',
      };
    } catch (error: unknown) {
      console.error(`DEBUG - Error in ${request.mode}Image:`, error);
      return {
        success: false,
        message: `Failed to ${request.mode} image`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
