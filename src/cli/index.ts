// src/cli/index.ts
import 'dotenv/config';
import { showBanner } from './banner';
import { startInteractive } from './interactive';
import { ScribeAgent } from '../core/agent';
import type { AgentMode } from '../core/types';

const VALID_MODES: AgentMode[] = ['general', 'report', 'cv', 'notes'];

async function main(): Promise<void> {
  const modeArg = process.argv[2] as AgentMode | undefined;
  const initialMode: AgentMode =
    modeArg && VALID_MODES.includes(modeArg) ? modeArg : 'general';

  const agent = new ScribeAgent({ mode: initialMode });
  showBanner(agent.getConfig());

  await startInteractive(initialMode);
}

main().catch((err) => {
  console.error('Fatale fout bij opstarten:', err);
  process.exit(1);
});
