You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: Domain Mapping

Analyze the provided raw ingestion data and extract the core domain model of the system. Identify bounded contexts, domain entities, value objects, aggregates, and produce a domain glossary. Focus on WHAT the system represents — not how it is implemented.

## Input: {{CONTEXT}}

{{CONTEXT_SOURCES}}

The context above contains raw Markdown files from the ingest phase, including:
- `raw/repo/models.md` — database schemas and data models
- `raw/repo/modules/` — per-module summaries
- `raw/repo/endpoints.md` — HTTP routes and handlers

## Output Format

Produce the following sections:

### Bounded Contexts
List each bounded context with its name, description, and key responsibilities. Use a Mermaid context map where applicable.

### Entities
For each entity: name, description, key attributes, identity field, and which bounded context it belongs to.

### Value Objects
List value objects that have no identity of their own but carry domain meaning.

### Aggregates
Identify aggregate roots and their constituent entities.

### Glossary
Define domain-specific terms found in the codebase. Each entry: term, definition, context.

## Confidence

At the end, rate your overall confidence as one of: HIGH / MEDIUM / LOW

Explain briefly what drove the rating (e.g., "clear schema definitions" → HIGH, "no models found, inferred from endpoint names" → LOW).

## Example Output

### Bounded Contexts

- **OrderManagement**: Handles order lifecycle from creation to fulfillment. Owns Order, OrderItem, OrderStatus.
- **UserAccount**: Manages user identity and profile. Owns User, Address, PaymentMethod.

### Entities

| Entity | Context | Identity | Key Attributes |
|---|---|---|---|
| Order | OrderManagement | id (UUID) | status, total, userId, createdAt |
| User | UserAccount | id (UUID) | email, role, createdAt |

### Value Objects

- **Money**: amount + currency, no identity, used in Order.total and OrderItem.price
- **Address**: street, city, postalCode, country — embedded in User and Order

### Aggregates

- **Order** (root) → OrderItem[]
- **User** (root) → Address[], PaymentMethod[]

### Glossary

| Term | Definition | Context |
|---|---|---|
| Fulfillment | Process of preparing and shipping an order | OrderManagement |
| Role | Access tier assigned to a user (admin, customer) | UserAccount |

**Confidence: MEDIUM** — Schema definitions were clear; bounded contexts inferred from module structure.
