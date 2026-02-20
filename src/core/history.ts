// src/core/history.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AgentMode } from './types';

const HISTORY_DIR = path.join(os.homedir(), '.scribeai', 'history');
const MAX_MESSAGES = 20;        // max berichten per modus in memory
const MAX_ASSISTANT_CHARS = 600; // lange antwoorden worden afgekapt in history

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ConversationHistory {
  private store: Map<AgentMode, Message[]> = new Map();

  constructor() {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  /** Voeg een bericht toe aan de history van een modus. */
  add(mode: AgentMode, role: 'user' | 'assistant', content: string): void {
    if (!this.store.has(mode)) this.store.set(mode, []);
    const msgs = this.store.get(mode)!;

    // Lange assistent-antwoorden inperken (CV-tekst hoeft niet volledig in history)
    const stored = role === 'assistant' && content.length > MAX_ASSISTANT_CHARS
      ? content.slice(0, MAX_ASSISTANT_CHARS) + '... [afgekapt]'
      : content;

    msgs.push({ role, content: stored });

    // Rolling window: bewaar alleen de laatste MAX_MESSAGES berichten
    if (msgs.length > MAX_MESSAGES) {
      msgs.splice(0, msgs.length - MAX_MESSAGES);
    }
  }

  /**
   * Geeft de history-context als string die vóór het huidige bericht wordt geplakt.
   * Geeft een lege string als er nog geen history is.
   */
  buildContext(mode: AgentMode): string {
    const msgs = this.store.get(mode) ?? [];
    if (msgs.length === 0) return '';

    const lines = msgs.map(m =>
      `${m.role === 'user' ? 'Gebruiker' : 'Assistent'}: ${m.content}`
    ).join('\n\n');

    return `[Vorige berichten in de ${mode}-sessie:]\n${lines}\n\n[Nieuw bericht van de gebruiker:]`;
  }

  /** Laad history van schijf voor een modus. */
  load(mode: AgentMode): void {
    const file = path.join(HISTORY_DIR, `${mode}.json`);
    if (!fs.existsSync(file)) return;
    try {
      const msgs = JSON.parse(fs.readFileSync(file, 'utf-8')) as Message[];
      this.store.set(mode, msgs.slice(-MAX_MESSAGES));
    } catch {
      // corrupt bestand negeren
    }
  }

  /** Sla history van een modus op naar schijf. */
  save(mode: AgentMode): void {
    const msgs = this.store.get(mode) ?? [];
    fs.writeFileSync(
      path.join(HISTORY_DIR, `${mode}.json`),
      JSON.stringify(msgs, null, 2),
      'utf-8'
    );
  }

  /** Wis history van een modus (of alle modi). */
  clear(mode?: AgentMode): void {
    if (mode) {
      this.store.delete(mode);
      const file = path.join(HISTORY_DIR, `${mode}.json`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      this.store.clear();
      for (const f of fs.readdirSync(HISTORY_DIR)) {
        if (f.endsWith('.json')) fs.unlinkSync(path.join(HISTORY_DIR, f));
      }
    }
  }
}
