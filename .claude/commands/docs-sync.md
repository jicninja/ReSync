Review all changes on the current branch vs main and check if CLAUDE.md and README.md need updating.

## Steps

1. Run `git diff main..HEAD --stat` to see all changed files
2. Classify changes into categories:
   - **CLI surface**: bin/respec.ts, new commands, new flags
   - **Config schema**: src/config/schema.ts, constants.ts
   - **Architecture**: new directories, new modules (src/wizard/, src/init/, src/ai/)
   - **Features**: new capabilities visible to users
   - **Internal only**: tests, refactors, prompts — skip these

3. For each non-internal change, check if CLAUDE.md and README.md already document it:
   - Read both files
   - Compare against actual code
   - Flag any drift: new flags not documented, new commands missing from tables, new modules not mentioned

4. If drift found:
   - Show a summary of what's missing
   - Apply the updates (keep existing style and structure)
   - Commit: `docs: sync CLAUDE.md and README.md with latest changes`

5. If no drift found:
   - Report "Docs are in sync, nothing to update"

## Rules
- Only update docs for user-facing changes
- Don't add internal implementation details to README
- CLAUDE.md gets architecture details, README gets usage details
- Keep existing structure — don't reorganize sections
- Don't touch other files
