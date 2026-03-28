import { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW, CONFIDENCE_TO_FLOAT } from '../constants.js';

export type ConfidenceLevel = typeof CONFIDENCE_HIGH | typeof CONFIDENCE_MEDIUM | typeof CONFIDENCE_LOW;

export interface ConfidenceItem {
  name: string;
  confidence: ConfidenceLevel;
  reason?: string;
}

export interface ConfidenceResult {
  overall: ConfidenceLevel;
  items: ConfidenceItem[];
}

export function parseConfidence(aiOutput: string): ConfidenceResult {
  const items: ConfidenceItem[] = [];

  // Pattern 1: **Confidence:** HIGH — reason
  const boldPattern = /\*\*Confidence:\*\*\s*(HIGH|MEDIUM|LOW)(?:\s*[—–-]\s*(.+))?/gi;
  let match: RegExpExecArray | null;
  while ((match = boldPattern.exec(aiOutput)) !== null) {
    items.push({
      name: 'Confidence',
      confidence: match[1].toUpperCase() as ConfidenceLevel,
      reason: match[2]?.trim(),
    });
  }

  // Pattern 2: [HIGH] ItemName — reason
  const bracketPattern = /^\s*\[(HIGH|MEDIUM|LOW)\]\s*(.+?)(?:\s*[—–-]\s*(.+))?$/gim;
  while ((match = bracketPattern.exec(aiOutput)) !== null) {
    const name = match[2]?.trim() ?? '';
    items.push({
      name,
      confidence: match[1].toUpperCase() as ConfidenceLevel,
      reason: match[3]?.trim(),
    });
  }

  // Pattern 3: | ItemName | HIGH | reason |
  // Anchored to line start to avoid partial matches spanning rows.
  // Skip separator rows (e.g. | --- | --- | --- |)
  const tablePattern = /^\|\s*([^|\n]+?)\s*\|\s*(HIGH|MEDIUM|LOW)\s*\|\s*([^|\n]+?)\s*\|/gim;
  while ((match = tablePattern.exec(aiOutput)) !== null) {
    const name = match[1].trim();
    // Skip header-like or separator rows
    if (/^-+$/.test(name)) continue;
    items.push({
      name,
      confidence: match[2].toUpperCase() as ConfidenceLevel,
      reason: match[3]?.trim(),
    });
  }

  // Pattern 4: Confidence: LOW (simple, unbolded — but not **Confidence:** already matched)
  // Use a non-bold version to avoid double-matching
  const simplePattern = /(?<!\*\*)Confidence:\s*(HIGH|MEDIUM|LOW)(?:\s*[—–-]\s*(.+))?/gi;
  while ((match = simplePattern.exec(aiOutput)) !== null) {
    items.push({
      name: 'Confidence',
      confidence: match[1].toUpperCase() as ConfidenceLevel,
      reason: match[2]?.trim(),
    });
  }

  // Deduplicate: remove items that appear more than once from overlapping patterns
  const unique = deduplicateItems(items);

  const overall = calculateOverall(unique, aiOutput);

  return { overall, items: unique };
}

function deduplicateItems(items: ConfidenceItem[]): ConfidenceItem[] {
  // Items from the bold pattern (**Confidence:**) would also match the simple pattern.
  // Keep track of seen (name, confidence, reason) tuples.
  const seen = new Set<string>();
  const result: ConfidenceItem[] = [];
  for (const item of items) {
    const key = `${item.name}|${item.confidence}|${item.reason ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function calculateOverall(items: ConfidenceItem[], aiOutput: string): ConfidenceLevel {
  // Check for explicit overall line: "Overall Confidence: HIGH"
  const overallMatch = aiOutput.match(/Overall\s+Confidence:\s*(HIGH|MEDIUM|LOW)/i);
  if (overallMatch) return overallMatch[1].toUpperCase() as ConfidenceLevel;

  // If we have items, use the lowest confidence
  if (items.length > 0) {
    if (items.some((i) => i.confidence === 'LOW')) return 'LOW';
    if (items.some((i) => i.confidence === 'MEDIUM')) return 'MEDIUM';
    return 'HIGH';
  }

  // Default to MEDIUM if nothing found
  return 'MEDIUM';
}

export function confidenceToFloat(level: ConfidenceLevel): number {
  return CONFIDENCE_TO_FLOAT[level] ?? 0.6;
}
