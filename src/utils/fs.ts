import * as fs from 'node:fs';
import * as path from 'node:path';
import { RESPEC_DIR, RAW_DIR_NAME, ANALYZED_DIR_NAME, GENERATED_DIR_NAME } from '../constants.js';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeMarkdown(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function readMarkdown(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function rawDir(projectDir: string): string {
  return path.join(projectDir, RESPEC_DIR, RAW_DIR_NAME);
}

export function analyzedDir(projectDir: string): string {
  return path.join(projectDir, RESPEC_DIR, ANALYZED_DIR_NAME);
}

export function generatedDir(projectDir: string, outputDir?: string): string {
  if (outputDir) {
    return path.resolve(projectDir, outputDir);
  }
  return path.join(projectDir, RESPEC_DIR, GENERATED_DIR_NAME);
}