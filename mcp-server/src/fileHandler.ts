/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSearchResult } from './types.js';

export class FileHandler {
  private static readonly OUTPUT_DIR = 'nanobanana-output';
  // os.homedir() resolves HOME on Unix and USERPROFILE on Windows.
  // Previously used `process.env.HOME || '~'` which produced a literal `~`
  // on Windows (Node does not set HOME by default), so Downloads/Desktop
  // lookups silently failed.
  private static readonly SEARCH_PATHS = [
    process.cwd(),
    path.join(process.cwd(), 'images'),
    path.join(process.cwd(), 'input'),
    path.join(process.cwd(), this.OUTPUT_DIR),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
  ];

  static ensureOutputDirectory(): string {
    const outputPath = path.join(process.cwd(), this.OUTPUT_DIR);

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    return outputPath;
  }

  static findInputFile(filename: string): FileSearchResult {
    if (path.isAbsolute(filename) && fs.existsSync(filename)) {
      return {
        found: true,
        filePath: filename,
        searchedPaths: [],
      };
    }

    const searchPaths = this.SEARCH_PATHS;

    for (const searchPath of searchPaths) {
      const fullPath = path.join(searchPath, filename);
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

  // Map a MIME type reported by the API to a file extension.
  // Returns undefined for unrecognised types so the caller falls back
  // to the requested `format` argument.
  private static extensionFromMimeType(mimeType?: string): string | undefined {
    if (!mimeType) return undefined;
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    switch (normalized) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      default:
        return undefined;
    }
  }

  static generateFilename(
    prompt: string,
    format: 'png' | 'jpeg' = 'png',
    index: number = 0,
    mimeType?: string,
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

    // Prefer extension derived from the actual response MIME type so the
    // bytes on disk match the filename. Only fall back to the caller-supplied
    // format when the MIME type is missing or unrecognised.
    const extension =
      FileHandler.extensionFromMimeType(mimeType) ??
      (format === 'jpeg' ? 'jpg' : 'png');

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
    const fullPath = path.join(outputPath, filename);

    await fs.promises.writeFile(fullPath, buffer);
    return fullPath;
  }

  static async readImageAsBase64(filePath: string): Promise<string> {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.toString('base64');
  }
}
