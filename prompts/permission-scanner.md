You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: Permission and Authorization Scanning

Analyze the provided raw ingestion data and extract the permission model of the system. Identify roles, access controls, and authorization rules applied to endpoints and operations.

## Input: {{CONTEXT}}

{{CONTEXT_SOURCES}}

{{TIER1_OUTPUT}}

The context above contains raw Markdown files from the ingest phase, including:
- `raw/repo/modules/` — per-module summaries with auth middleware and guards
- `raw/repo/endpoints.md` — HTTP routes with access control annotations

## Output Format

Produce the following sections:

### Roles
List all user roles or groups found in the system. For each: name, description, and typical capabilities.

### Permission Matrix
A table mapping roles to resources/operations (CRUD or custom actions). Use a Mermaid table or Markdown table.

### Authorization Rules
For each authorization rule: ID (PERM-NNN), resource, action, required role(s), and enforcement mechanism (e.g., middleware, decorator, guard).

### Public Endpoints
List endpoints or operations that require no authentication.

### Sensitive Operations
Flag operations that appear to require elevated privileges or special handling.

## Confidence

At the end, rate your overall confidence as one of: HIGH / MEDIUM / LOW

Explain briefly what drove the rating (e.g., "consistent RBAC decorators throughout" → HIGH, "auth logic scattered across modules" → MEDIUM).

## Example Output

### Roles

| Role | Description | Typical Capabilities |
|---|---|---|
| admin | Full system access | All CRUD, user management, config |
| customer | Authenticated end user | Own orders and profile only |
| guest | Unauthenticated visitor | Browse products, view public content |

### Permission Matrix

| Resource | admin | customer | guest |
|---|---|---|---|
| GET /products | R | R | R |
| POST /orders | RW | W | — |
| GET /users | RW | — | — |
| DELETE /orders/:id | D | — | — |

### Authorization Rules

| ID | Resource | Action | Required Role | Mechanism |
|---|---|---|---|---|
| PERM-001 | /admin/* | All | admin | @Roles('admin') guard |
| PERM-002 | /orders/:id | DELETE | admin | middleware: requireRole |

### Public Endpoints

- `GET /products` — product catalogue listing
- `GET /products/:id` — product detail
- `POST /auth/login` — authentication

### Sensitive Operations

- `DELETE /users/:id` — admin-only, no soft-delete
- `POST /admin/refunds` — elevated, requires 2FA flag

**Confidence: HIGH** — Consistent use of @Roles decorators across all controllers.
