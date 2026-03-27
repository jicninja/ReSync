You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: Flow Extraction

Analyze the provided raw ingestion data and extract user flows and data flows. Map out how users interact with the system and how data moves through it. Focus on observable behavior — entry points, decision branches, outcomes.

## Input: {{CONTEXT}}

The context above contains raw Markdown files from the ingest phase, including:
- `raw/repo/endpoints.md` — HTTP routes and handlers
- `raw/repo/modules/` — per-module summaries
- `raw/jira/stories.md` — user stories describing intended behavior

## Output Format

Produce the following sections:

### User Flows
For each major user flow: name, actor, preconditions, steps (numbered), and outcome. Include a Mermaid sequence or flowchart diagram.

### Data Flows
For each data flow: name, data entity involved, source, transformations, destination. Include a Mermaid data flow diagram where helpful.

### Integration Flows
If the system integrates with external services, describe those flows: trigger, external system, data exchanged, error handling.

## Confidence

At the end, rate your overall confidence as one of: HIGH / MEDIUM / LOW

Explain briefly what drove the rating (e.g., "detailed stories aligned with endpoints" → HIGH, "only partial endpoint coverage" → MEDIUM).
