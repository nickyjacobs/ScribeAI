// src/core/types.ts
import * as os from 'os';
import * as path from 'path';

export type AgentMode = 'general' | 'report' | 'cv' | 'notes';

export type ModelAlias = 'sonnet' | 'haiku' | 'opus';

export interface AgentConfig {
  mode: AgentMode;
  model: ModelAlias;
}

export interface ModeDefinition {
  name: AgentMode;
  label: string;
  description: string;
  instructions: string;
  commands: string[];
  workflows: string[];
}

export interface OutputPaths {
  reports: string;
  cv: string;
}

export interface ScribeConfig {
  obsidianVaultPath: string;
  defaultExportFormat: 'markdown' | 'pdf' | 'docx';
  defaultModel: ModelAlias;
  outputPaths: OutputPaths;
  profile: {
    name: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
  };
}

/** Huidig document in de CLI-sessie */
export interface DocumentDraft {
  path: string;        // pad naar het draft-bestand
  mode: AgentMode;     // welke modus het document hoort
  title: string;       // titel voor weergave
}

const HOME = os.homedir();

export const DEFAULT_CONFIG: ScribeConfig = {
  obsidianVaultPath: '',
  defaultExportFormat: 'markdown',
  defaultModel: 'sonnet',
  outputPaths: {
    reports: path.join(HOME, 'Documents', 'ScribeAI', 'reports'),
    cv:      path.join(HOME, 'Documents', 'ScribeAI', 'cv'),
  },
  profile: {
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
  },
};

export const MODEL_IDS: Record<ModelAlias, string> = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
  opus:   'claude-opus-4-6',
};

export const MODEL_LABELS: Record<ModelAlias, string> = {
  sonnet: 'Claude Sonnet 4.6 (standaard)',
  haiku:  'Claude Haiku 4.5 (snel/zuinig)',
  opus:   'Claude Opus 4.6 (krachtig)',
};
