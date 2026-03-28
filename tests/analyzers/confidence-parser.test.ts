import { describe, it, expect } from 'vitest';
import { parseConfidence, confidenceToFloat } from '../../src/analyzers/confidence-parser.js';

describe('parseConfidence', () => {
  it('parses **Confidence:** HIGH — reason pattern', () => {
    const output = '**Confidence:** HIGH — clear evidence in the codebase';
    const result = parseConfidence(output);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].confidence).toBe('HIGH');
    expect(result.items[0].reason).toBe('clear evidence in the codebase');
  });

  it('parses [HIGH] EntityName — reason pattern', () => {
    const output = '[HIGH] UserEntity — well defined in the schema';
    const result = parseConfidence(output);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].confidence).toBe('HIGH');
    expect(result.items[0].name).toBe('UserEntity');
    expect(result.items[0].reason).toBe('well defined in the schema');
  });

  it('parses table format | EntityName | HIGH | reason |', () => {
    const output = `| Analyzer | Status | Confidence |
| --- | --- | --- |
| EntityName | HIGH | found in models |`;
    const result = parseConfidence(output);
    expect(result.items.length).toBeGreaterThan(0);
    const highItem = result.items.find((i) => i.confidence === 'HIGH');
    expect(highItem).toBeDefined();
    expect(highItem?.name).toBe('EntityName');
    expect(highItem?.reason).toBe('found in models');
  });

  it('parses Confidence: LOW simple format', () => {
    const output = 'Confidence: LOW';
    const result = parseConfidence(output);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].confidence).toBe('LOW');
    expect(result.overall).toBe('LOW');
  });

  it('parses multiple items in one output', () => {
    const output = `
[HIGH] UserEntity — clear schema definition
[MEDIUM] OrderFlow — partial evidence
[LOW] PaymentRule — inferred from comments
`;
    const result = parseConfidence(output);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].confidence).toBe('HIGH');
    expect(result.items[1].confidence).toBe('MEDIUM');
    expect(result.items[2].confidence).toBe('LOW');
  });

  it('calculates overall as lowest confidence when items present', () => {
    const output = `
[HIGH] EntityA — solid evidence
[MEDIUM] FlowB — partial
[LOW] RuleC — weak
`;
    const result = parseConfidence(output);
    expect(result.overall).toBe('LOW');
  });

  it('calculates overall as MEDIUM when lowest is MEDIUM', () => {
    const output = `
[HIGH] EntityA — solid evidence
[MEDIUM] FlowB — partial
`;
    const result = parseConfidence(output);
    expect(result.overall).toBe('MEDIUM');
  });

  it('extracts explicit "Overall Confidence: HIGH" line', () => {
    const output = `
[LOW] SomeItem — weak
Overall Confidence: HIGH
`;
    const result = parseConfidence(output);
    expect(result.overall).toBe('HIGH');
  });

  it('returns MEDIUM as default when nothing found', () => {
    const result = parseConfidence('No confidence information here.');
    expect(result.overall).toBe('MEDIUM');
    expect(result.items).toHaveLength(0);
  });

  it('handles empty string', () => {
    const result = parseConfidence('');
    expect(result.overall).toBe('MEDIUM');
    expect(result.items).toHaveLength(0);
  });
});

describe('confidenceToFloat', () => {
  it('maps HIGH to 0.9', () => {
    expect(confidenceToFloat('HIGH')).toBe(0.9);
  });

  it('maps MEDIUM to 0.6', () => {
    expect(confidenceToFloat('MEDIUM')).toBe(0.6);
  });

  it('maps LOW to 0.3', () => {
    expect(confidenceToFloat('LOW')).toBe(0.3);
  });
});
