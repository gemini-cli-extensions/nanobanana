/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSearchResult } from './types.js';

export class FileHandler {
  private static readonly OUTPUT_DIR = 'nanobanana-output';
  private static readonly SEARCH_PATHS = [
    process.cwd(),
    path.join(process.cwd(), 'images'),
    path.join(process.cwd(), 'input'),
    path.join(process.cwd(), this.OUTPUT_DIR),
    path.join(process.env.HOME || '~', 'Downloads'),
    path.join(process.env.HOME || '~', 'Desktop'),
  ];

  static ensureOutputDirectory(): string {
    const outputPath = path.join(process.cwd(), this.OUTPUT_DIR);

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    return outputPath;
  }

  static findInputFile(filename: string): FileSearchResult {
    // Reject absolute paths — callers must provide a filename, not a full path
    if (path.isAbsolute(filename)) {
      return { found: false, searchedPaths: [] };
    }

    // Reject traversal sequences that could escape the search roots
    const normalized = path.normalize(filename);
    if (normalized.startsWith('..') || normalized.includes(path.sep + '..')) {
      return { found: false, searchedPaths: [] };
    }

    const searchPaths = this.SEARCH_PATHS;

    for (const searchPath of searchPaths) {
      const resolvedRoot = path.resolve(searchPath);
      const fullPath = path.resolve(searchPath, filename);

      // Ensure the resolved path stays within the search root
      if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
        continue;
      }

      if (fs.existsSync(fullPath)) {
        return {
          found: true,
          filePath: fullPath,
          searchedPaths: searchPaths,
        };
      }
    }

    return {
      found: false,
      searchedPaths: searchPaths,
    };
  }

  static generateFilename(
    prompt: string,
    format: 'png' | 'jpeg' = 'png',
    index: number = 0,
  ): string {
    // Create user-friendly filename from prompt
    let baseName = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 32); // Limit to 32 characters

    if (!baseName) {
      baseName = 'generated_image';
    }

    const extension = format === 'jpeg' ? 'jpg' : 'png';

    // Check for existing files and add counter if needed
    const outputPath = this.ensureOutputDirectory();
    let fileName = `${baseName}.${extension}`;
    let counter = index > 0 ? index : 1;

    while (fs.existsSync(path.join(outputPath, fileName))) {
      fileName = `${baseName}_${counter}.${extension}`;
      counter++;
    }

    return fileName;
  }

  static async saveImageFromBase64(
    base64Data: string,
    outputPath: string,
    filename: string,
  ): Promise<string> {
    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
    if (buffer.length > MAX_SIZE) {
      throw new Error('Image data exceeds the maximum allowed size of 50 MB');
    }

    const fullPath = path.join(outputPath, filename);
    await fs.promises.writeFile(fullPath, buffer);
    return fullPath;
  }

  static async readImageAsBase64(filePath: string): Promise<string> {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.toString('base64');
  }
}
