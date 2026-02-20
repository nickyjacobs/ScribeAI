// src/config/manager.ts
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import yaml from 'js-yaml';
import { ScribeConfig, DEFAULT_CONFIG } from '../core/types';

const CONFIG_DIR  = path.join(os.homedir(), '.scribeai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');
const DRAFTS_DIR  = path.join(CONFIG_DIR, 'drafts');

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR))  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
}

export function loadConfig(): ScribeConfig {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = yaml.load(raw) as Partial<ScribeConfig>;
    // Merge met defaults zodat nieuwe velden altijd aanwezig zijn
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: ScribeConfig): void {
  ensureConfigDir();
  const yamlStr = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(CONFIG_FILE, yamlStr, 'utf-8');
}

export function updateConfig(partial: Partial<ScribeConfig>): ScribeConfig {
  const current = loadConfig();
  const updated = deepMerge(current, partial);
  saveConfig(updated);
  return updated;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getDraftsDir(): string {
  return DRAFTS_DIR;
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !Array.isArray(val)) {
        result[key] = deepMerge(base[key] as object, val as object) as T[typeof key];
      } else {
        result[key] = val as T[typeof key];
      }
    }
  }
  return result;
}
