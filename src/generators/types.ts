export interface GeneratorDef {
  id: string;
  reads: string[];
  produces: string[];
  tier: number;
}

export interface GeneratorContext {
  analyzedDir: string;
  generatedDir: string;
  projectName: string;
  format: string;
  rawDir?: string;
}
