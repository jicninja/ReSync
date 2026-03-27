You are a senior software architect performing reverse engineering analysis on a legacy codebase.

## Task: Business Rule and Validation Rule Mining

Analyze the provided raw ingestion data and extract explicit and implicit business rules and validation rules. Business rules encode domain policy; validation rules enforce data integrity constraints.

## Input: {{CONTEXT}}

{{CONTEXT_SOURCES}}

{{TIER1_OUTPUT}}

The context above contains raw Markdown files from the ingest phase, including:
- `raw/repo/modules/` — per-module summaries containing logic and conditions
- `raw/jira/stories.md` — acceptance criteria and story descriptions
- `raw/jira/bugs.md` — bug reports that often reveal implicit rules

## Output Format

Produce the following sections:

### Business Rules
For each rule: ID (BR-NNN), name, description, source (where it was found), and enforcement point (e.g., service layer, database constraint).

### Validation Rules
For each rule: ID (VR-NNN), field or entity it applies to, constraint description, error message (if found), and where it is enforced.

### Derived Rules
Rules that were not explicitly stated but are implied by the code or bug patterns. Mark these as INFERRED.

## Confidence

At the end, rate your overall confidence as one of: HIGH / MEDIUM / LOW

Explain briefly what drove the rating (e.g., "rich acceptance criteria in stories" → HIGH, "rules inferred from bug descriptions only" → LOW).

## Example Output

### Business Rules

| ID | Name | Description | Source | Enforcement Point |
|---|---|---|---|---|
| BR-001 | Order minimum value | Orders must total at least $5.00 | stories.md: PROJ-42 | OrderService.create() |
| BR-002 | Single active subscription | A user may only hold one active subscription at a time | modules/subscription.md | SubscriptionService |

### Validation Rules

| ID | Field/Entity | Constraint | Error Message | Enforced At |
|---|---|---|---|---|
| VR-001 | User.email | Must be valid RFC 5322 email | "Invalid email address" | API layer + DB |
| VR-002 | Order.quantity | Must be integer >= 1 | "Quantity must be at least 1" | OrderItem model |

### Derived Rules

- **BR-INFERRED-001**: Orders cannot be cancelled after status=SHIPPED — inferred from bug PROJ-88 where refund logic skipped shipped orders.

**Confidence: HIGH** — Acceptance criteria in stories were detailed; several rules confirmed by bug reports.
