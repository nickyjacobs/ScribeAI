// src/core/agent.ts
import { AgentConfig, AgentMode, ModelAlias, MODEL_LABELS } from './types';
import { streamAgent } from '../providers/agent-sdk';
import { ConversationHistory } from './history';
import { loadConfig } from '../config/manager';

export class ScribeAgent {
  private config: AgentConfig;

  /**
   * Gesprekshistory per modus — exposed zodat commands.ts (vrij gesprek)
   * deze kan lezen/schrijven. Workflows gebruiken agent.chat() direct
   * zonder history (ze bouwen hun eigen contextprompt op).
   */
  readonly history: ConversationHistory;

  constructor(overrides?: Partial<AgentConfig>) {
    const fileConfig = loadConfig();
    this.config = {
      mode: overrides?.mode ?? 'general',
      model: overrides?.model ?? fileConfig.defaultModel,
    };
    this.history = new ConversationHistory();
    // Laad bestaande history voor de startmodus
    this.history.load(this.config.mode);
  }

  /**
   * Stream een antwoord van de agent.
   * Geen automatische history — workflows bouwen hun eigen prompt op.
   * Voor vrij gesprek met history: gebruik streamChat() in commands.ts.
   */
  async *chat(prompt: string): AsyncGenerator<string> {
    yield* streamAgent(prompt, {
      mode: this.config.mode,
      model: this.config.model,
    });
  }

  setMode(mode: AgentMode): void {
    this.config.mode = mode;
    // Laad history voor de nieuwe modus zodat context bewaard blijft
    this.history.load(mode);
  }

  setModel(model: ModelAlias): void {
    this.config.model = model;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getStatus(): string {
    return `Modus: ${this.config.mode} | Model: ${MODEL_LABELS[this.config.model]}`;
  }
}
