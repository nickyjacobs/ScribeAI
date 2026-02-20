// src/providers/agent-sdk.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentMode, ModelAlias, MODEL_IDS } from '../core/types';
import { getModeInstructions } from '../modes';

interface QueryOptions {
  mode: AgentMode;
  model?: ModelAlias;
}

/**
 * Streaming versie — voor real-time output in de CLI.
 * Elke tekst-chunk wordt direct doorgestuurd.
 */
export async function* streamAgent(
  prompt: string,
  options: QueryOptions
): AsyncGenerator<string> {
  const systemPrompt = getModeInstructions(options.mode);
  const modelId = MODEL_IDS[options.model ?? 'sonnet'];

  for await (const message of query({
    prompt,
    options: {
      systemPrompt,
      model: modelId,
      allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
      settingSources: ['project'],
      maxTurns: 10,
    },
  })) {
    if (message.type === 'assistant') {
      for (const block of (message as any).message?.content ?? []) {
        if (block.type === 'text') {
          yield block.text as string;
        }
      }
    }
  }
}

/**
 * Niet-streaming versie — wacht op het volledige antwoord.
 */
export async function askAgent(
  prompt: string,
  options: QueryOptions
): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of streamAgent(prompt, options)) {
    chunks.push(chunk);
  }
  return chunks.join('');
}
