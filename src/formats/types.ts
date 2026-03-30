import type { ReSpecConfig } from '../config/schema.js';

export interface FormatAdapter {
  name: string;
  package(specsDir: string, outputDir: string, context: FormatContext): Promise<void>;
}

export interface FormatContext {
  projectName: string;
  projectDescription: string;
  sddContent: string;
  analyzedDir: string;
  specsDir: string;
  config: ReSpecConfig;
  ciMode: boolean;
}
