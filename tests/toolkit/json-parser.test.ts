import { describe, it, expect } from 'vitest';
import { extractJSON } from '../../src/toolkit/json-parser.js';

describe('extractJSON', () => {
  it('parses raw JSON', () => {
    const input = '{"stack":{"detected":["nextjs"],"format":"openspec","multiAgent":true},"recommendations":[],"workflowGuidance":{"complexity":"simple","suggestedWorkflow":"basic","reason":"small project"}}';
    const result = extractJSON(input);
    expect(result!.stack.detected).toEqual(['nextjs']);
  });

  it('extracts JSON from markdown code fences', () => {
    const input = 'Here are the recommendations:\n```json\n{"stack":{"detected":[],"format":"openspec","multiAgent":false},"recommendations":[],"workflowGuidance":{"complexity":"simple","suggestedWorkflow":"basic","reason":"r"}}\n```';
    const result = extractJSON(input);
    expect(result).toBeDefined();
    expect(result!.recommendations).toEqual([]);
  });

  it('extracts JSON from bare code fences', () => {
    const input = '```\n{"stack":{"detected":[],"format":"openspec","multiAgent":false},"recommendations":[],"workflowGuidance":{"complexity":"simple","suggestedWorkflow":"basic","reason":"r"}}\n```';
    const result = extractJSON(input);
    expect(result).toBeDefined();
  });

  it('returns null for invalid JSON', () => {
    const result = extractJSON('this is not json at all');
    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    const result = extractJSON('');
    expect(result).toBeNull();
  });
});
