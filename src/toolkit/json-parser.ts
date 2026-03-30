import type { ToolkitRecommendations } from './types.js';

export function extractJSON(text: string): ToolkitRecommendations | null {
  if (!text || text.trim().length === 0) return null;

  // Try raw parse first
  try {
    return JSON.parse(text.trim());
  } catch {
    // Continue to fence extraction
  }

  // Extract from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      return null;
    }
  }

  return null;
}
