# Internal Output Dir for ReSpec (Implicit .respec)

Date: 2026-03-29

## Summary
ReSpec internal artifacts (raw/analyzed/generated) should live under `.respec/` by default without requiring `output.dir` in the YAML. If `output.dir` is explicitly provided, it only affects internal ReSpec artifacts. Exported format outputs (openspec/kiro/antigravity/etc.) remain format-defined and do not use `output.dir`.

## Goals
- Default internal output to `.respec/generated` without requiring `output.dir` in `respec.config.yaml`.
- Allow optional `output.dir` to redirect internal ReSpec artifacts only.
- Ensure `export` always writes to format-specific locations, independent of `output.dir`.
- Align `generate`, `review`, `push`, and `diff` to read/write internal artifacts consistently.

## Non-Goals
- Changing how format adapters choose their output locations.
- Introducing warnings or errors for presence/absence of `output.dir`.
- Backward-compatibility guarantees beyond accepting explicit `output.dir` when present.

## Design

### 1) Config & Directory Resolution
- `output.dir` is optional and does not appear by default in `respec.config.yaml`.
- If `output.dir` is present, it defines the internal ReSpec artifacts root (raw/analyzed/generated).
- If `output.dir` is absent, internal outputs default implicitly to `.respec/generated` (and related paths under `.respec/`).
- No warnings or errors are emitted when `output.dir` is missing or present.

### 2) Command Behavior
- `generate` writes to the internal generated directory derived from `output.dir` or the implicit default.
- `export` reads from the internal generated directory and writes to the format-defined output location (e.g., root folder for that format), ignoring `output.dir`.
- `review`, `push`, and `diff` read from the same internal generated directory used by `generate`.

### 3) API/Helpers & Tests
- Introduce a helper `generatedDir(projectDir, outputDir?)`:
  - If `outputDir` is provided, `path.resolve(projectDir, outputDir)`.
  - Otherwise, `path.join(projectDir, '.respec', 'generated')`.
- Update tests to cover both cases (implicit default and explicit override).

## Data Flow (Simplified)
```
respec generate
  └─ writes internal artifacts → generatedDir(projectDir, outputDir?)

respec export
  ├─ reads internal artifacts ← generatedDir(projectDir, outputDir?)
  └─ writes format output → format-defined location
```

## Open Questions
- None.

## Success Criteria
- Internal artifacts are always under `.respec/` unless `output.dir` is explicitly set.
- Exported format output ignores `output.dir` and remains unchanged.
- All impacted commands and tests pass.
