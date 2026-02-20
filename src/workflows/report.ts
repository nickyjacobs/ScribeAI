// src/workflows/report.ts
import { select, input, editor, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ScribeAgent } from '../core/agent';
import { DocumentDraft } from '../core/types';
import { renderTemplate, listTemplates } from '../utils/templates';
import { saveMarkdown, buildFilename, getDefaultOutputDir, exportDocument } from '../utils/export';
import { createBackup } from '../utils/versioning';
import { getDraftsDir } from '../config/manager';

// Labels + beschrijvingen per template — uitgebreid wanneer nieuwe types toegevoegd worden
const TEMPLATE_META: Record<string, { icon: string; label: string; description: string }> = {
  'project-rapport': {
    icon: '📄',
    label: 'Project Rapport',
    description: 'Projectverslagen, statusupdates, voortgangsrapporten en eindevaluaties',
  },
  'onderzoeksrapport': {
    icon: '🔬',
    label: 'Onderzoeksrapport',
    description: 'Wetenschappelijk of marktonderzoek: hypothese → methode → resultaten → conclusie',
  },
  'incident-rapport': {
    icon: '⚠️ ',
    label: 'Incident Rapport',
    description: 'Documenteer een incident: oorzaakanalyse, tijdlijn, impact en preventie',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  GENERATE — nieuw rapport genereren
// ─────────────────────────────────────────────────────────────────────────────

export async function runGenerate(agent: ScribeAgent): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n📄 Nieuw rapport genereren\n'));

  const templates = listTemplates('report');
  if (templates.length === 0) {
    console.log(chalk.red('❌ Geen templates gevonden in templates/report/\n'));
    return null;
  }

  // ── Stap 1: template kiezen ──────────────────────────────────────────────
  const templateValue = await select({
    message: 'Welk type rapport wil je genereren?',
    choices: templates.map(t => {
      const meta = TEMPLATE_META[t];
      return {
        name:        meta ? `${meta.icon} ${meta.label}` : formatTemplateName(t),
        value:       t,
        description: meta ? chalk.dim(meta.description) : '',
      };
    }),
  });

  // ── Stap 2: basisinformatie ──────────────────────────────────────────────
  const title = await input({
    message: 'Titel van het rapport:',
    validate: (v) => v.trim().length > 0 || 'Titel mag niet leeg zijn.',
  });

  const subject = await input({
    message: 'Onderwerp — wat wil je communiceren of aantonen?',
    validate: (v) => v.trim().length > 0 || 'Geef een onderwerp op.',
  });

  const audience = await input({
    message: 'Doelgroep:',
    default: 'algemeen',
    transformer: (v) => v || 'algemeen',
  });

  const authorDefault = loadAuthorFromConfig();
  const author = await input({
    message: 'Auteur:',
    default: authorDefault,
  });

  // ── Stap 3: extra context (optioneel) ────────────────────────────────────
  const contextMethod = await select({
    message: 'Voeg extra context of bronmateriaal toe?',
    choices: [
      {
        name:        '⏩ Direct genereren',
        value:       'none',
        description: chalk.dim('Geen extra input — de agent genereert op basis van titel en onderwerp'),
      },
      {
        name:        '✏️  Tekst invoeren of plakken',
        value:       'editor',
        description: chalk.dim('Opent je teksteditor ($EDITOR). Plak notities, data of beschrijvingen en sla op.'),
      },
      {
        name:        '📁 Bestandspad opgeven',
        value:       'file',
        description: chalk.dim('Geef het pad naar een .txt / .md / .csv / .json bestand als bronmateriaal.'),
      },
    ],
  });

  let extraContext = '';

  if (contextMethod === 'editor') {
    extraContext = await editor({
      message: 'Voer je bronmateriaal in (sluit de editor om door te gaan):',
      default: '# Bronmateriaal\n\nPlak of typ hier je notities, data of beschrijvingen.\n',
      postfix: '.md',
    });
    extraContext = extraContext.trim();
    console.log(chalk.green(`✅ Context ontvangen (${extraContext.length} tekens)\n`));
  } else if (contextMethod === 'file') {
    const filePath = await input({
      message: 'Pad naar het bestand (bijv. ~/notities.md of /tmp/data.csv):',
      validate: (v) => {
        const expanded = expandPath(v.trim());
        if (!fs.existsSync(expanded)) return `Bestand niet gevonden: ${expanded}`;
        return true;
      },
    });
    try {
      extraContext = fs.readFileSync(expandPath(filePath.trim()), 'utf-8');
      console.log(chalk.green(`✅ Bestand ingeladen (${extraContext.length} tekens)\n`));
    } catch (e: any) {
      console.log(chalk.red(`❌ Kon bestand niet lezen: ${e.message}\n`));
    }
  }

  // ── Stap 4: template renderen als structuur-skeleton ─────────────────────
  const date = new Date().toLocaleDateString('nl-NL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const skeleton = renderTemplate('report', templateValue, { title, date, author });

  // ── Stap 5: Claude aanroepen ──────────────────────────────────────────────
  const prompt = buildGeneratePrompt({ title, subject, audience, template: templateValue }, skeleton, extraContext);

  console.log(chalk.yellow('\n🤖 Rapport genereren...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  let fullContent = '';
  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
    fullContent += chunk;
  }

  console.log(chalk.dim('\n' + '─'.repeat(60)));

  // ── Stap 6: opslaan als draft ─────────────────────────────────────────────
  const filename  = buildFilename(title);
  const draftsDir = getDraftsDir();
  const draftPath = saveMarkdown(fullContent, draftsDir, filename);

  console.log(chalk.green(`\n✅ Draft opgeslagen: ${chalk.bold(draftPath)}`));
  console.log(chalk.dim('  → "export" om het naar je documenten-map te kopiëren'));
  console.log(chalk.dim('  → "update" om een sectie bij te werken\n'));

  return { path: draftPath, mode: 'report', title };
}

// ─────────────────────────────────────────────────────────────────────────────
//  OUTLINE — alleen structuur/outline genereren
// ─────────────────────────────────────────────────────────────────────────────

export async function runOutline(agent: ScribeAgent): Promise<void> {
  console.log(chalk.yellow('\n📋 Rapport-outline genereren\n'));

  const templates = listTemplates('report');

  const templateValue = await select({
    message: 'Type rapport:',
    choices: templates.map(t => {
      const meta = TEMPLATE_META[t];
      return {
        name:        meta ? `${meta.icon} ${meta.label}` : formatTemplateName(t),
        value:       t,
        description: meta ? chalk.dim(meta.description) : '',
      };
    }),
  });

  const title   = await input({ message: 'Werktitel:', validate: (v) => v.trim().length > 0 || 'Vereist.' });
  const subject = await input({ message: 'Onderwerp:', validate: (v) => v.trim().length > 0 || 'Vereist.' });
  const audience = await input({ message: 'Doelgroep:', default: 'algemeen' });

  const prompt = `Genereer een gedetailleerde outline voor een "${TEMPLATE_META[templateValue]?.label ?? templateValue}".

Titel: ${title}
Onderwerp: ${subject}
Doelgroep: ${audience}

Geef een genummerde outline met hoofdsecties en subsecties.
Voeg per sectie een korte beschrijving toe van wat er behandeld moet worden.
Schrijf in het Nederlands. Houd het professioneel en beknopt.
Geef ALLEEN de outline, geen uitgewerkte tekst.`;

  console.log(chalk.yellow('\n🤖 Outline genereren...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
  }

  console.log(chalk.dim('\n' + '─'.repeat(60) + '\n'));
  console.log(chalk.dim('  → "generate" om het volledige rapport te genereren\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE — bestaand rapport bijwerken
// ─────────────────────────────────────────────────────────────────────────────

export async function runUpdate(
  agent: ScribeAgent,
  currentDraft: DocumentDraft | null
): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n✏️  Rapport bijwerken\n'));

  // ── Stap 1: welk bestand? ────────────────────────────────────────────────
  let targetPath: string;

  if (currentDraft) {
    const useCurrent = await confirm({
      message: `Huidig document bijwerken? (${path.basename(currentDraft.path)})`,
      default: true,
    });
    targetPath = useCurrent ? currentDraft.path : await pickDraftOrPath();
  } else {
    targetPath = await pickDraftOrPath();
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    console.log(chalk.red('❌ Bestand niet gevonden.\n'));
    return currentDraft;
  }

  // ── Stap 2: sectie kiezen ────────────────────────────────────────────────
  const content  = fs.readFileSync(targetPath, 'utf-8');
  const headings = extractHeadings(content);

  if (headings.length === 0) {
    console.log(chalk.yellow('⚠️  Geen secties gevonden in het bestand.\n'));
    return currentDraft;
  }

  const section = await select({
    message: 'Welke sectie wil je bijwerken?',
    choices: [
      ...headings.map(h => ({ name: h, value: h, description: chalk.dim('Alleen deze sectie aanpassen') })),
      { name: '🔄 Volledig rapport herschrijven', value: '__all__', description: chalk.dim('Houdt structuur en frontmatter intact') },
    ],
  });

  const instruction = await input({
    message: 'Wat moet er veranderen of toegevoegd worden?',
    validate: (v) => v.trim().length > 0 || 'Geef een instructie op.',
  });

  // ── Stap 3: backup ───────────────────────────────────────────────────────
  const backupPath = createBackup(targetPath);
  console.log(chalk.dim(`\n💾 Backup: ${path.basename(backupPath)}`));

  // ── Stap 4: Claude ────────────────────────────────────────────────────────
  const updatePrompt = buildUpdatePrompt(content, section, instruction);

  console.log(chalk.yellow('\n🤖 Sectie bijwerken...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  let updatedContent = '';
  for await (const chunk of agent.chat(updatePrompt)) {
    process.stdout.write(chunk);
    updatedContent += chunk;
  }

  console.log(chalk.dim('\n' + '─'.repeat(60)));

  // ── Stap 5: opslaan ──────────────────────────────────────────────────────
  fs.writeFileSync(targetPath, updatedContent, 'utf-8');
  console.log(chalk.green(`\n✅ Bijgewerkt: ${chalk.bold(targetPath)}\n`));

  const title = currentDraft?.title || path.basename(targetPath, '.md');
  return { path: targetPath, mode: 'report', title };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT — naar finale output-map
// ─────────────────────────────────────────────────────────────────────────────

export async function runExport(currentDraft: DocumentDraft | null): Promise<void> {
  console.log(chalk.yellow('\n📤 Rapport exporteren\n'));

  let sourcePath: string;

  if (currentDraft) {
    const useCurrent = await confirm({
      message: `Huidig document exporteren? (${path.basename(currentDraft.path)})`,
      default: true,
    });
    sourcePath = useCurrent ? currentDraft.path : await pickDraftOrPath();
  } else {
    sourcePath = await pickDraftOrPath();
  }

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(chalk.red('❌ Bronbestand niet gevonden.\n'));
    return;
  }

  const defaultDir = getDefaultOutputDir('report');

  const destDir = await input({
    message: 'Doelmap:',
    default: defaultDir,
  });

  const filename = await input({
    message: 'Bestandsnaam:',
    default: path.basename(sourcePath),
  });

  const finalPath = exportDocument(sourcePath, expandPath(destDir), filename);
  console.log(chalk.green(`\n✅ Geëxporteerd: ${chalk.bold(finalPath)}\n`));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hulpfuncties
// ─────────────────────────────────────────────────────────────────────────────

function buildGeneratePrompt(
  meta: { title: string; subject: string; audience: string; template: string },
  skeleton: string,
  context: string
): string {
  return `Schrijf een volledig, professioneel rapport in het Nederlands.

**Rapport informatie:**
- Titel: ${meta.title}
- Onderwerp: ${meta.subject}
- Doelgroep: ${meta.audience}
- Type: ${TEMPLATE_META[meta.template]?.label ?? meta.template}
${context ? `\n**Beschikbaar bronmateriaal:**\n${context}\n` : ''}
**Gebruik de volgende structuur** (vul alle secties in met concrete inhoud):

${skeleton}

**Richtlijnen:**
- Schrijf in helder, zakelijk Nederlands
- Vul de HTML-commentaren (<!-- ... -->) in met echte inhoud; verwijder de commentaartags zelf
- Voeg concrete details, analyses en aanbevelingen toe
- Houd de YAML-frontmatter intact aan het begin van het document
- Lever het VOLLEDIGE rapport op, niet alleen een samenvatting`;
}

function buildUpdatePrompt(content: string, section: string, instruction: string): string {
  if (section === '__all__') {
    return `Herschrijf het onderstaande rapport op basis van deze instructie: "${instruction}"

Houd de YAML-frontmatter en de algemene structuur intact. Geef het VOLLEDIGE rapport terug.

---
${content}`;
  }

  return `Je krijgt een rapport en de opdracht om één sectie bij te werken.

**Sectie:** ${section}
**Instructie:** ${instruction}

Geef het VOLLEDIGE rapport terug met de bijgewerkte sectie.
Verander niets aan andere secties. Houd de YAML-frontmatter intact.

---
${content}`;
}

function extractHeadings(content: string): string[] {
  return content
    .split('\n')
    .filter(line => /^#{1,3} /.test(line))
    .map(line => line.replace(/^#+\s/, '').trim())
    .filter(h => h.length > 0 && !h.startsWith('---'));
}

async function pickDraftOrPath(): Promise<string> {
  const draftsDir = getDraftsDir();
  const drafts = fs.existsSync(draftsDir)
    ? fs.readdirSync(draftsDir)
        .filter(f => f.endsWith('.md') && !f.includes('_backup_'))
        .map(f => ({ name: f, value: path.join(draftsDir, f) }))
    : [];

  if (drafts.length > 0) {
    const choice = await select({
      message: 'Kies een draft:',
      choices: [
        ...drafts.map(d => ({ ...d, description: chalk.dim(d.value) })),
        { name: '📁 Ander bestandspad invoeren', value: '__custom__', description: chalk.dim('Voer zelf een volledig pad in') },
      ],
    });
    if (choice !== '__custom__') return choice;
  }

  const filePath = await input({ message: 'Volledig pad naar het Markdown-bestand:' });
  return expandPath(filePath.trim());
}

function formatTemplateName(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function loadAuthorFromConfig(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadConfig } = require('../config/manager');
    return (loadConfig().profile.name as string) || '';
  } catch {
    return '';
  }
}

function expandPath(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}
