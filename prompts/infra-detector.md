You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: Infrastructure and Architecture Detection

Analyze the provided raw ingestion data and reconstruct the infrastructure architecture and data storage strategy of the system. Identify compute, storage, messaging, and deployment characteristics.

## Input: {{CONTEXT}}

The context above contains raw Markdown files from the ingest phase, including:
- `raw/repo/dependencies.md` — package dependencies revealing infrastructure choices
- `raw/repo/env-vars.md` — environment variables revealing external services and config
- `raw/repo/structure.md` — directory tree indicating project layout and deployment units

## Output Format

Produce the following sections:

### Architecture Overview
High-level architecture description with a Mermaid diagram showing major components and their relationships.

### Compute
Runtime environment, framework, and any serverless or containerization signals (e.g., Dockerfile, Lambda handlers).

### Data Storage
For each storage system: type (relational DB, cache, object store, search index), technology, purpose, and connection method.

### Messaging and Queues
Any message brokers, job queues, or event buses detected. Include technology, topics/queues found, and producers/consumers.

### External Services
Third-party services used for email, payments, auth, analytics, etc. Infer from env var names and dependency names.

### Deployment Signals
CI/CD hints, cloud provider clues, environment names (staging, production), and configuration management patterns.

## Confidence

At the end, rate your overall confidence as one of: HIGH / MEDIUM / LOW

Explain briefly what drove the rating (e.g., "explicit Docker Compose and .env files" → HIGH, "minimal env vars, no infra config found" → LOW).
