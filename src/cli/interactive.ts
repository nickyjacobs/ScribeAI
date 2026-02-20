// src/cli/interactive.ts
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { ScribeAgent } from '../core/agent';
import { handleCommand, CLIState } from './commands';
import type { AgentMode } from '../core/types';

export async function startInteractive(initialMode: AgentMode = 'general'): Promise<void> {
  const agent = new ScribeAgent({ mode: initialMode });
  let state: CLIState = { agent, currentDocument: null };

  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⚠️  SIGTERM ontvangen — ScribeAI sluit af.\n'));
    process.exit(0);
  });

  // Gebruik @inquirer/prompts voor de hele loop zodat editor() / select() / input()
  // geen conflict geven met een externe readline-interface.
  while (true) {
    const mode = state.agent.getConfig().mode;

    let userInput: string;
    try {
      userInput = await input({
        message: chalk.dim('>'),
        theme: {
          prefix: chalk.yellow(`[${mode}]`),
        },
      });
    } catch {
      // Ctrl+C of stdin gesloten
      console.log(chalk.yellow('\n👋 Tot ziens!\n'));
      process.exit(0);
    }

    try {
      state = await handleCommand(userInput.trim(), state);
    } catch (err: any) {
      console.error(chalk.red(`\n❌ Fout: ${err.message}\n`));
    }
  }
}
