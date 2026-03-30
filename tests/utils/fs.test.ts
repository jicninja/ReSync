import { describe, it, expect } from 'vitest';
import { generatedDir } from '../../src/utils/fs.js';

describe('generatedDir', () => {
  it('uses implicit .respec/generated when outputDir is omitted', () => {
    expect(generatedDir('/project')).toBe('/project/.respec/generated');
  });

  it('resolves an explicit outputDir relative to project root', () => {
    expect(generatedDir('/project', './custom-specs')).toBe('/project/custom-specs');
  });
});
