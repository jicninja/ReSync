// ── Configuration Defaults ──────────────────────────────────────────
export const DEFAULT_AI_ENGINE = 'claude' as const;
export const DEFAULT_AI_TIMEOUT_SECONDS = 600;
export const DEFAULT_MAX_PARALLEL = 4;
export const DEFAULT_OUTPUT_DIR = './specs';
export const DEFAULT_OUTPUT_FORMAT = 'openspec' as const;
export const DEFAULT_DIAGRAM_TYPE = 'mermaid' as const;
export const DEFAULT_REPO_BRANCH = 'main';

// ── Directory & File Names ──────────────────────────────────────────
export const RESPEC_DIR = '.respec';
export const RAW_DIR_NAME = 'raw';
export const ANALYZED_DIR_NAME = 'analyzed';
export const STATE_FILENAME = 'state.json';
export const CONFIG_FILENAME = 'respec.config.yaml';

// ── Output Formats ──────────────────────────────────────────────────
export const FORMAT_KIRO = 'kiro' as const;
export const FORMAT_OPENSPEC = 'openspec' as const;
export const FORMAT_ANTIGRAVITY = 'antigravity' as const;
export const FORMAT_SUPERPOWERS = 'superpowers' as const;
export const OUTPUT_FORMATS = [FORMAT_KIRO, FORMAT_OPENSPEC, FORMAT_ANTIGRAVITY, FORMAT_SUPERPOWERS] as const;

// ── AI Engines ──────────────────────────────────────────────────────
export const ENGINE_CLAUDE = 'claude' as const;
export const ENGINE_CODEX = 'codex' as const;
export const ENGINE_GEMINI = 'gemini' as const;
export const ENGINE_CUSTOM = 'custom' as const;
export const AI_ENGINES = [ENGINE_CLAUDE, ENGINE_CODEX, ENGINE_GEMINI, ENGINE_CUSTOM] as const;

// ── Pipeline Phases ─────────────────────────────────────────────────
export const PHASE_EMPTY = 'empty' as const;
export const PHASE_INGESTED = 'ingested' as const;
export const PHASE_ANALYZED = 'analyzed' as const;
export const PHASE_GENERATED = 'generated' as const;
export const PHASE_ORDER = [PHASE_EMPTY, PHASE_INGESTED, PHASE_ANALYZED, PHASE_GENERATED] as const;

// ── Ingestor Limits ─────────────────────────────────────────────────
export const MAX_SCAN_DEPTH = 6;
export const MAX_FILE_CONTENT_CHARS = 3000;
export const JIRA_BATCH_SIZE = 100;

// ── Shared File Patterns ────────────────────────────────────────────
export const CODE_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.mjs', '.cjs', '.mts', '.cts']);
export const EXCLUDED_DIRS = ['node_modules', 'dist', 'build', '.next', 'coverage'];
export const SOURCE_ROOT_CANDIDATES = ['src', 'lib', 'app', 'packages'];

// ── Validation ──────────────────────────────────────────────────────
export const RAW_KEY_FILES = [
  'repo/structure.md',
  'repo/dependencies.md',
  'repo/endpoints.md',
  'repo/models.md',
  'repo/env-vars.md',
  '_manifest.md',
];

export const ANALYZED_KEY_FILES = [
  'domain/entities.md',
  'domain/bounded-contexts.md',
  'flows/user-flows.md',
  'infra/architecture.md',
  '_analysis-report.md',
];
