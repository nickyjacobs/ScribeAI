// src/cli/banner.ts
import figlet from 'figlet';
import gradientString from 'gradient-string';
import chalk from 'chalk';
import { AgentConfig, MODEL_LABELS } from '../core/types';

export function showBanner(config: AgentConfig): void {
  console.clear();

  const title = figlet.textSync('ScribeAI', { font: 'Slant' });
  // Goud → oranje gradient: past bij schrijven/documentatie
  console.log(gradientString('#f7971e', '#ffd200')(title));
  console.log(gradientString('#f7971e', '#ffd200')('  AI Documentatie-Agent — Rapporten · CV\'s · Notities\n'));

  console.log(`  ${chalk.dim('Modus:')}  ${chalk.yellow(config.mode)}`);
  console.log(`  ${chalk.dim('Model:')}  ${chalk.yellow(MODEL_LABELS[config.model])}`);
  console.log(`  ${chalk.dim('Config:')} ${chalk.dim('~/.scribeai/config.yaml')}`);
  console.log();
  console.log(chalk.dim('  Typ "help" voor alle commando\'s of begin direct met typen.\n'));
}
