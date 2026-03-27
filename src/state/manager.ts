import * as fs from 'node:fs';
import { join } from 'node:path';
import {
  PipelineState,
  PipelinePhase,
  IngestState,
  AnalyzeState,
  GenerateState,
} from './types.js';
import {
  RESPEC_DIR,
  STATE_FILENAME,
  PHASE_INGESTED,
  PHASE_ANALYZED,
  PHASE_GENERATED,
  PHASE_ORDER,
} from '../constants.js';

const EMPTY_STATE: PipelineState = {
  phase: 'empty',
  ingest: null,
  analyze: null,
  generate: null,
};

export class StateManager {
  private readonly stateDir: string;
  private readonly statePath: string;

  constructor(private readonly projectDir: string) {
    this.stateDir = join(projectDir, RESPEC_DIR);
    this.statePath = join(this.stateDir, STATE_FILENAME);
  }

  load(): PipelineState {
    if (!fs.existsSync(this.statePath)) {
      return { ...EMPTY_STATE };
    }

    const raw = fs.readFileSync(this.statePath, 'utf-8');
    return JSON.parse(raw) as PipelineState;
  }

  save(state: PipelineState): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  completeIngest(data: Omit<IngestState, 'completed_at'>): PipelineState {
    const state = this.load();
    const updated: PipelineState = {
      ...state,
      phase: PHASE_INGESTED,
      ingest: {
        ...data,
        completed_at: new Date().toISOString(),
      },
    };
    this.save(updated);
    return updated;
  }

  completeAnalyze(data: Omit<AnalyzeState, 'completed_at'>): PipelineState {
    const state = this.load();
    const updated: PipelineState = {
      ...state,
      phase: PHASE_ANALYZED,
      analyze: {
        ...data,
        completed_at: new Date().toISOString(),
      },
    };
    this.save(updated);
    return updated;
  }

  completeGenerate(data: Omit<GenerateState, 'completed_at'>): PipelineState {
    const state = this.load();
    const updated: PipelineState = {
      ...state,
      phase: PHASE_GENERATED,
      generate: {
        ...data,
        completed_at: new Date().toISOString(),
      },
    };
    this.save(updated);
    return updated;
  }

  requirePhase(required: PipelinePhase): void {
    const state = this.load();
    const currentIndex = PHASE_ORDER.indexOf(state.phase);
    const requiredIndex = PHASE_ORDER.indexOf(required);

    if (currentIndex < requiredIndex) {
      throw new Error(
        `Pipeline phase "${required}" is required, but current phase is "${state.phase}". ` +
          `Run the prerequisite commands first.`
      );
    }
  }
}
