You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: API Contract Mapping

Analyze the provided raw ingestion data and produce detailed API contracts. Map each endpoint to its request/response shapes, error codes, and dependencies on external services.

## Input: {{CONTEXT}}

The context above contains raw Markdown files from the ingest phase, including:
- `raw/repo/endpoints.md` — HTTP routes with methods, paths, and handler descriptions
- `raw/repo/models.md` — data models that inform request/response schemas

## Output Format

Produce the following sections:

### API Contracts
For each endpoint group (resource): method, path, summary, request body schema (JSON Schema style), response schema, HTTP status codes, and auth requirements.

### External Dependencies
List all external APIs, third-party services, or downstream systems the codebase depends on. For each: name, purpose, protocol, and criticality (HIGH/MEDIUM/LOW).

### API Conventions
Document patterns observed across the API: base URL prefix, pagination style, error envelope format, versioning strategy, authentication method.

## Confidence

At the end, rate your overall confidence as one of: HIGH / MEDIUM / LOW

Explain briefly what drove the rating (e.g., "full OpenAPI annotations present" → HIGH, "only route paths found, no type info" → LOW).
