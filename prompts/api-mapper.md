You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: API Contract Mapping

Analyze the provided raw ingestion data and produce detailed API contracts. Map each endpoint to its request/response shapes, error codes, and dependencies on external services.

## Input: {{CONTEXT}}

{{CONTEXT_SOURCES}}

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

## Example Output

### API Contracts

**Resource: Orders**

| Method | Path | Summary | Auth |
|---|---|---|---|
| POST | /api/v1/orders | Create a new order | Bearer (customer) |
| GET | /api/v1/orders/:id | Get order by ID | Bearer (customer/admin) |

Request body for `POST /api/v1/orders`:
```json
{ "cartId": "uuid", "paymentMethodId": "uuid", "shippingAddressId": "uuid" }
```
Response `201`:
```json
{ "id": "uuid", "status": "PENDING", "total": 49.99, "createdAt": "ISO8601" }
```

### External Dependencies

| Name | Purpose | Protocol | Criticality |
|---|---|---|---|
| Stripe | Payment processing | HTTPS REST | HIGH |
| SendGrid | Transactional email | HTTPS REST | MEDIUM |

### API Conventions

- Base prefix: `/api/v1`
- Pagination: `?page=N&limit=N`, response wraps in `{ data, meta: { total, page } }`
- Error envelope: `{ error: { code, message } }`
- Auth: Bearer JWT in `Authorization` header

**Confidence: MEDIUM** — Routes were well-documented; request/response schemas inferred from model definitions.
