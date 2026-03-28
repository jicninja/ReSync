import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown } from '../../../src/ingestors/docs/html-to-markdown.js';

describe('convertHtmlToMarkdown', () => {
  it('converts basic HTML elements to Markdown', () => {
    const html = `
      <h1>Hello World</h1>
      <p>This is a <a href="https://example.com">link</a>.</p>
      <ul>
        <li>Item one</li>
        <li>Item two</li>
      </ul>
    `;
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('# Hello World');
    expect(result).toContain('[link](https://example.com)');
    expect(result).toContain('Item one');
    expect(result).toContain('Item two');
  });

  it('strips ac:structured-macro blocks', () => {
    const html = `
      <p>Before macro</p>
      <ac:structured-macro ac:name="code">
        <ac:parameter ac:name="language">javascript</ac:parameter>
        <ac:plain-text-body><![CDATA[const x = 1;]]></ac:plain-text-body>
      </ac:structured-macro>
      <p>After macro</p>
    `;
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('Before macro');
    expect(result).toContain('After macro');
    // The macro block itself should be removed
    expect(result).not.toContain('ac:structured-macro');
    expect(result).not.toContain('ac:parameter');
  });

  it('converts ac:plain-text-body to fenced code blocks', () => {
    const html = `<ac:plain-text-body>const greeting = "hello";</ac:plain-text-body>`;
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('```');
    expect(result).toContain('const greeting = "hello";');
  });

  it('handles empty string input', () => {
    const result = convertHtmlToMarkdown('');
    expect(result).toBe('');
  });

  it('strips self-closing ri: tags', () => {
    const html = `<p>See <ri:user ri:userkey="abc123"/> for details.</p>`;
    const result = convertHtmlToMarkdown(html);
    expect(result).not.toContain('ri:user');
    expect(result).toContain('See');
    expect(result).toContain('for details.');
  });

  it('strips self-closing ac: tags', () => {
    const html = `<p>Link: <ac:link/> here.</p>`;
    const result = convertHtmlToMarkdown(html);
    expect(result).not.toContain('ac:link');
    expect(result).toContain('Link:');
    expect(result).toContain('here.');
  });

  it('strips remaining ac: element pairs not already removed', () => {
    const html = `<p>Before</p><ac:image><ri:attachment ri:filename="diagram.png"/></ac:image><p>After</p>`;
    const result = convertHtmlToMarkdown(html);
    expect(result).not.toContain('ac:image');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });
});
