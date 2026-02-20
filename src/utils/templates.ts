// src/utils/templates.ts
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

/**
 * Laadt en rendert een Handlebars template.
 * @param category  'report' | 'cv'
 * @param name      bestandsnaam zonder .hbs extensie
 * @param data      variabelen die in het template worden ingevuld
 */
export function renderTemplate(
  category: string,
  name: string,
  data: Record<string, string>
): string {
  const filePath = path.join(TEMPLATES_DIR, category, `${name}.hbs`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Template niet gevonden: ${filePath}`);
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  const compiled = Handlebars.compile(source);
  return compiled(data);
}

/** Geeft de beschikbare templates terug voor een categorie */
export function listTemplates(category: string): string[] {
  const dir = path.join(TEMPLATES_DIR, category);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.hbs'))
    .map(f => f.replace('.hbs', ''));
}
