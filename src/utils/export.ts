// src/utils/export.ts
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../config/manager';
import { AgentMode } from '../core/types';

/**
 * Bepaalt de standaard output-map op basis van de modus en config.
 */
export function getDefaultOutputDir(mode: AgentMode): string {
  const config = loadConfig();
  switch (mode) {
    case 'cv':     return config.outputPaths.cv;
    case 'report': return config.outputPaths.reports;
    default:       return config.outputPaths.reports;
  }
}

/**
 * Exporteert een draft-bestand naar een finale locatie.
 * Maakt de doelmap aan als die nog niet bestaat.
 * Geeft het finale pad terug.
 */
export function exportDocument(sourcePath: string, destDir: string, filename?: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Bronbestand niet gevonden: ${sourcePath}`);
  }

  fs.mkdirSync(destDir, { recursive: true });

  const finalName = filename || path.basename(sourcePath);
  const destPath  = path.join(destDir, finalName);

  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}

/**
 * Slaat gegenereerde content direct op als Markdown-bestand.
 * Maakt de doelmap aan als nodig. Geeft het pad terug.
 */
export function saveMarkdown(content: string, destDir: string, filename: string): string {
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, filename.endsWith('.md') ? filename : `${filename}.md`);
  fs.writeFileSync(destPath, content, 'utf-8');
  return destPath;
}

/**
 * Maakt een bestandsnaam op basis van een titel en timestamp.
 * Voorbeeld: "Projectrapport Q1" → "projectrapport-q1_2026-02-19.md"
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // accenten verwijderen
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

export function buildFilename(title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${slugify(title)}_${date}.md`;
}
