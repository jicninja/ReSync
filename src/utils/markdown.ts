export function heading(level: number, text: string): string {
  return `${'#'.repeat(level)} ${text}`;
}

export function table(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerRow, separator, ...dataRows].join('\n');
}

export function codeBlock(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

export function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function timestamp(): string {
  return new Date().toISOString();
}
