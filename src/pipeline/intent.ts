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
