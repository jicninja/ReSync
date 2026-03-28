import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorContext } from './types.js';

function readAnalyzedFiles(analyzedDir: string): string {
  if (!fs.existsSync(analyzedDir)) {
    return '';
  }

  const sections: string[] = [];

  function readDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const rel = path.relative(analyzedDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        sections.push(`### ${rel}\n\n${content}`);
      }
    }
  }

  readDir(analyzedDir);
  return sections.join('\n\n---\n\n');
}

export function buildSDDPrompt(ctx: GeneratorContext): string {
  const analyzedContent = readAnalyzedFiles(ctx.analyzedDir);

  return `You are a senior software architect producing a System Design Document (SDD) for the project "${ctx.projectName}".

IMPORTANT: You are running as a text-generation subprocess. Do NOT attempt to create files, use tools, or interact with any system. Your ONLY output is the raw Markdown text written to stdout. Everything you write goes directly into a single output file.

Using the analyzed artifacts below, generate a complete 12-section SDD in Markdown format.

## Analyzed Artifacts

${analyzedContent || '(No analyzed artifacts found — generate a template SDD based on available context.)'}

---

## Instructions

Generate a complete SDD with exactly the following 12 sections. Each section should be thorough, implementation-agnostic, and describe WHAT the system does (not HOW it is built).

1. **Overview** — High-level description of the system, its purpose, and the problem it solves.
2. **Goals & Non-Goals** — What the system aims to achieve and explicit out-of-scope items.
3. **Domain Model** — Core domain concepts, entities, and their relationships.
4. **Architecture** — System components, their responsibilities, and how they interact.
5. **Data Model** — Data structures, storage strategies, and data lifecycle.
6. **API Design** — External interfaces, endpoints, request/response contracts.
7. **User Flows** — Key end-to-end user journeys through the system.
8. **Business Rules** — Domain invariants, constraints, and validation logic.
9. **Security & Auth** — Authentication, authorization, and data protection strategies.
10. **Infrastructure & Deployment** — Hosting, scaling, CI/CD, and operational concerns.
11. **Migration Strategy** — How to transition from the current system to the new one.
12. **Open Questions** — Unresolved decisions, ambiguities, and items requiring stakeholder input.

Use Mermaid diagrams where appropriate (architecture diagrams, sequence diagrams, ERDs).
Output format: Markdown. Output the full SDD starting with a top-level heading \`# System Design Document: ${ctx.projectName}\`.`;
}
