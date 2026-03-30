interface LowPriorityResult {
  analyzers: string[];
  generators: string[];
}

const INTENT_PRIORITY_RULES: Array<{
  keywords: string[];
  analyzers: string[];
  generators: string[];
}> = [
  {
    keywords: ['upgrade', 'update', 'version'],
    analyzers: ['flow-extractor', 'permission-scanner'],
    generators: ['flow-gen'],
  },
  {
    keywords: ['audit', 'review'],
    analyzers: [],
    generators: ['task-gen', 'format-gen'],
  },
];

export function getLowPriorityIds(intent: string | undefined): LowPriorityResult {
  if (!intent) return { analyzers: [], generators: [] };

  const lower = intent.toLowerCase();
  const analyzers: string[] = [];
  const generators: string[] = [];

  for (const rule of INTENT_PRIORITY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      analyzers.push(...rule.analyzers);
      generators.push(...rule.generators);
    }
  }

  return {
    analyzers: [...new Set(analyzers)],
    generators: [...new Set(generators)],
  };
}

export function appendIntentToPrompt(
  prompt: string,
  intent: string | undefined,
  contextNotes: string | undefined,
): string {
  if (!intent && !contextNotes) return prompt;

  let sections = '';
  if (intent) {
    sections += `\n\n## Project Intent\n\n${intent}`;
  }
  if (contextNotes) {
    sections += `\n\n## Additional Context\n\n${contextNotes}`;
  }

  return prompt + sections;
}
