export type WizardState = 'no-config' | 'empty' | 'ingested' | 'analyzed' | 'generated';

export type WizardAction =
  | 'init' | 'ingest' | 'analyze' | 'generate' | 'export'
  | 'autopilot' | 'reset' | 'status' | 'validate' | 'review' | 'diff' | 'push-jira' | 'exit';

export interface MenuOption {
  value: WizardAction;
  label: string;
  hint?: string;
}

const MENUS: Record<WizardState, { options: Omit<MenuOption, 'hint'>[]; recommended: WizardAction }> = {
  'no-config': {
    recommended: 'init',
    options: [
      { value: 'init', label: 'Initialize project (create config)' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'empty': {
    recommended: 'ingest',
    options: [
      { value: 'ingest', label: 'Ingest sources' },
      { value: 'autopilot', label: 'Autopilot — run full pipeline' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'ingested': {
    recommended: 'analyze',
    options: [
      { value: 'analyze', label: 'Analyze with AI' },
      { value: 'autopilot', label: 'Autopilot — run remaining pipeline' },
      { value: 'ingest', label: 'Re-ingest sources' },
      { value: 'reset', label: 'Start fresh — wipe all and re-run' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'analyzed': {
    recommended: 'generate',
    options: [
      { value: 'generate', label: 'Generate specs' },
      { value: 'autopilot', label: 'Autopilot — run remaining pipeline' },
      { value: 'analyze', label: 'Re-analyze' },
      { value: 'diff', label: 'View diff from last run' },
      { value: 'reset', label: 'Start fresh — wipe all and re-run' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
  'generated': {
    recommended: 'export',
    options: [
      { value: 'export', label: 'Export to format' },
      { value: 'review', label: 'Review specs (detect hallucinations)' },
      { value: 'generate', label: 'Re-generate specs' },
      { value: 'push-jira', label: 'Push tasks to Jira' },
      { value: 'diff', label: 'View diff from last run' },
      { value: 'validate', label: 'Validate output' },
      { value: 'reset', label: 'Start fresh — wipe all and re-run' },
      { value: 'status', label: 'View status' },
      { value: 'exit', label: 'Exit' },
    ],
  },
};

export function buildMenuOptions(state: WizardState): MenuOption[] {
  const menu = MENUS[state];
  return menu.options.map((opt) => ({
    ...opt,
    hint: opt.value === menu.recommended ? '(recommended)' : undefined,
  }));
}
