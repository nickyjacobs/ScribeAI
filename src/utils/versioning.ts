// src/utils/versioning.ts
import * as fs from 'fs';
import * as path from 'path';

/**
 * Maakt een timestamped backup van een bestand vóór een update.
 * Backup wordt naast het origineel opgeslagen als <name>_backup_<timestamp>.md
 * Geeft het pad naar de backup terug.
 */
export function createBackup(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Bestand niet gevonden voor backup: ${filePath}`);
  }

  const dir  = path.dirname(filePath);
  const ext  = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(dir, `${base}_backup_${ts}${ext}`);

  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Geeft alle backups van een bestand terug, gesorteerd van nieuw naar oud.
 */
export function listBackups(filePath: string): string[] {
  const dir  = path.dirname(filePath);
  const ext  = path.extname(filePath);
  const base = path.basename(filePath, ext);

  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(f => f.startsWith(`${base}_backup_`) && f.endsWith(ext))
    .map(f => path.join(dir, f))
    .sort()
    .reverse();
}
