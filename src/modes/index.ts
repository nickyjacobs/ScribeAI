// src/modes/index.ts
import { AgentMode, ModeDefinition } from '../core/types';
import general from './general';
import report from './report';
import cv from './cv';
import notes from './notes';

const MODES: Record<AgentMode, ModeDefinition> = {
  general,
  report,
  cv,
  notes,
};

export function getModeDefinition(mode: AgentMode): ModeDefinition {
  return MODES[mode] ?? MODES.general;
}

export function getModeInstructions(mode: AgentMode): string {
  return getModeDefinition(mode).instructions;
}

export function getAvailableModes(): ModeDefinition[] {
  return Object.values(MODES);
}
