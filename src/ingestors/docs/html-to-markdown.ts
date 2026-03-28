import TurndownService from 'turndown';

export function convertHtmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  // Strip Confluence macros before conversion
  let cleaned = html;
  cleaned = cleaned.replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/gi, '');
  cleaned = cleaned.replace(/<ac:plain-text-body[^>]*>([\s\S]*?)<\/ac:plain-text-body>/gi,
    (_, content) => `<pre><code>${content}</code></pre>`);
  cleaned = cleaned.replace(/<ri:[^>]*\/>/gi, '');
  cleaned = cleaned.replace(/<ac:[^>]*\/>/gi, '');
  cleaned = cleaned.replace(/<ac:[^>]*>[\s\S]*?<\/ac:[^>]*>/gi, '');

  return td.turndown(cleaned);
}
