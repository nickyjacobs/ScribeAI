// src/workflows/cv.ts
import { select, input, editor, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ScribeAgent } from '../core/agent';
import { DocumentDraft } from '../core/types';
import { buildFilename, getDefaultOutputDir, slugify } from '../utils/export';
import { createBackup } from '../utils/versioning';
import { loadConfig } from '../config/manager';
import { fetchGitHubProfile, fetchGitHubRepos, formatGitHubContext } from '../utils/github';
import { generateCVPdf, parseFrontmatter, parseSections, parseSidebarItems } from '../utils/pdf';
import { EDITABLE_SIDEBAR, isHobbyTitle, SidebarItem } from '../utils/cv-templates';

const CV_DRAFTS_DIR  = path.join(os.homedir(), '.scribeai', 'drafts', 'cv');
const MASTER_CV_PATH = path.join(os.homedir(), '.scribeai', 'profile', 'master-cv.md');

// ─────────────────────────────────────────────────────────────────────────────
//  GENERATE — nieuw CV vanuit profiel + interactieve input
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVGenerate(agent: ScribeAgent): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n📋 Nieuw CV genereren\n'));

  fs.mkdirSync(CV_DRAFTS_DIR, { recursive: true });

  // ── Master profiel als basis? ────────────────────────────────────────────
  let masterContext = '';
  if (fs.existsSync(MASTER_CV_PATH)) {
    const useMaster = await confirm({
      message: 'Master profiel gevonden — als basis gebruiken?',
      default: true,
    });
    if (useMaster) {
      masterContext = fs.readFileSync(MASTER_CV_PATH, 'utf-8');
      console.log(chalk.green('✅ Master profiel ingeladen\n'));
    }
  }

  // ── Contactgegevens (pre-fill uit config) ────────────────────────────────
  const config  = loadConfig();
  const profile = config.profile;

  console.log(chalk.dim('  Contactgegevens (Enter = huidige waarde bewaren)\n'));

  const name     = await input({ message: 'Naam:',                default: profile.name     || '' });
  const jobTitle = await input({ message: 'Gewenste functietitel:', validate: (v) => v.trim().length > 0 || 'Vereist.' });
  const email    = await input({ message: 'Email:',               default: profile.email    || '' });
  const phone    = await input({ message: 'Telefoon:',            default: profile.phone    || '' });
  const linkedin = await input({ message: 'LinkedIn URL:',        default: profile.linkedin || '' });
  const github   = await input({ message: 'GitHub gebruikersnaam:', default: profile.github || '' });
  const location = await input({ message: 'Locatie:',             default: '' });

  // ── Extra context ────────────────────────────────────────────────────────
  const contextMethod = await select({
    message: 'Voeg werkervaring / vaardigheden toe?',
    choices: [
      { name: '⏩ Direct genereren', value: 'none',
        description: chalk.dim('Genereert op basis van profiel en bovenstaande info') },
      { name: '✏️  Tekst invoeren / plakken', value: 'editor',
        description: chalk.dim('Opent editor — plak werkervaring, projecten, vaardigheden') },
      { name: '📁 Bestand uploaden', value: 'file',
        description: chalk.dim('.txt of .md bestand met je werkervaring als bronmateriaal') },
      { name: '🐙 GitHub importeren', value: 'github',
        description: chalk.dim('Haalt je publieke repos en profiel op via de GitHub API') },
    ],
  });

  let extraContext = '';

  if (contextMethod === 'editor') {
    extraContext = await editor({
      message: 'Voer je werkervaring en vaardigheden in:',
      default: '# Werkervaring\n\n# Vaardigheden\n\n# Opleiding\n\n# Overig\n',
      postfix: '.md',
    });
  } else if (contextMethod === 'file') {
    const filePath = await input({
      message: 'Pad naar het bestand:',
      validate: (v) => fs.existsSync(expandPath(v.trim())) || `Bestand niet gevonden: ${v}`,
    });
    extraContext = fs.readFileSync(expandPath(filePath.trim()), 'utf-8');
    console.log(chalk.green(`✅ Bestand ingeladen (${extraContext.length} tekens)\n`));
  } else if (contextMethod === 'github') {
    const username = github || await input({ message: 'GitHub gebruikersnaam:' });
    extraContext   = await fetchAndFormatGitHub(username.trim());
  }

  // ── Template kiezen ──────────────────────────────────────────────────────
  const templateChoice = await select({
    message: 'Kies een CV template:',
    choices: [
      {
        name: '🌑 Donker   — donkere sidebar, blauwe header-kaart',
        value: 'donker',
        description: chalk.dim('Donkere achtergrond, blauwe kaart met contact en naam'),
      },
      {
        name: '📄 Klassiek — lichte sidebar, navy header-balk',
        value: 'klassiek',
        description: chalk.dim('Traditionele look, grijze sidebar, volledige navy header-balk'),
      },
      {
        name: '◆ Strak    — gekleurde sidebar met naam en contact',
        value: 'strak',
        description: chalk.dim('Naam en contactgegevens IN de gekleurde sidebar, geen aparte header'),
      },
    ],
  }) as 'donker' | 'klassiek' | 'strak';

  // ── Doelfunctie/vacature (optioneel) ────────────────────────────────────
  const hasTarget = await confirm({
    message: 'Wil je het CV optimaliseren voor een specifieke vacature?',
    default: false,
  });

  let jobDescription = '';
  if (hasTarget) {
    jobDescription = await editor({
      message: 'Plak de vacaturetekst:',
      postfix: '.txt',
    });
  }

  // ── Claude aanroepen ──────────────────────────────────────────────────────
  const date    = new Date().toISOString().slice(0, 10);
  const version = nextVersionNumber();

  const prompt = buildGeneratePrompt({
    name, jobTitle, email, phone, linkedin, github, location, date, version,
    masterContext, extraContext, jobDescription,
  });

  console.log(chalk.yellow('\n🤖 CV genereren...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  let fullContent = '';
  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
    fullContent += chunk;
  }
  console.log(chalk.dim('\n' + '─'.repeat(60)));

  // ── Opslaan ──────────────────────────────────────────────────────────────
  const filename  = `cv_v${version}_${date}.md`;
  const draftPath = path.join(CV_DRAFTS_DIR, filename);
  const contentWithTemplate = injectFrontmatterField(fullContent, 'template', templateChoice);
  fs.writeFileSync(draftPath, contentWithTemplate, 'utf-8');

  console.log(chalk.green(`\n✅ CV opgeslagen: ${chalk.bold(draftPath)}`));
  console.log(chalk.dim('  → "export" voor PDF  |  "target" voor vacature-optimalisatie  |  "review" voor feedback\n'));

  // ── Bijwerken als master profiel? ─────────────────────────────────────────
  if (!fs.existsSync(MASTER_CV_PATH)) {
    const saveMaster = await confirm({
      message: 'Dit is je eerste CV — opslaan als master profiel voor toekomstige versies?',
      default: true,
    });
    if (saveMaster) {
      fs.copyFileSync(draftPath, MASTER_CV_PATH);
      console.log(chalk.green(`✅ Master profiel opgeslagen: ${MASTER_CV_PATH}\n`));
    }
  }

  return { path: draftPath, mode: 'cv', title: `CV v${version} — ${name}` };
}

// ─────────────────────────────────────────────────────────────────────────────
//  IMPORT — bestaand CV uploaden
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVImport(agent: ScribeAgent, args: string[]): Promise<DocumentDraft | null> {
  // import github [username]  of  import file
  const subCmd = args[0]?.toLowerCase();

  if (subCmd === 'github') {
    return importFromGitHub(agent, args[1]);
  }
  return importFromFile(agent);
}

async function importFromFile(agent: ScribeAgent): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n📁 CV importeren uit bestand\n'));

  const filePath = await input({
    message: 'Pad naar je bestaande CV (.md of .txt):',
    validate: (v) => {
      const p = expandPath(v.trim());
      if (!fs.existsSync(p)) return `Bestand niet gevonden: ${p}`;
      if (!['.md', '.txt'].includes(path.extname(p).toLowerCase())) {
        return 'Ondersteunde formaten: .md of .txt (voor PDF: exporteer eerst als tekst)';
      }
      return true;
    },
  });

  const rawContent = fs.readFileSync(expandPath(filePath.trim()), 'utf-8');
  console.log(chalk.green(`✅ Bestand ingeladen (${rawContent.length} tekens)\n`));

  const prompt = `Converteer het volgende CV naar het ScribeAI CV-formaat (Markdown met YAML-frontmatter).

Bewaar ALLE informatie uit het origineel. Voeg geen informatie toe die er niet in staat.
Zorg dat de YAML-frontmatter volledig is ingevuld op basis van wat je kunt afleiden.
Gebruik version: 1 en de datum van vandaag (${new Date().toISOString().slice(0, 10)}).

Origineel CV:
${rawContent}`;

  console.log(chalk.yellow('🤖 CV converteren naar ScribeAI-formaat...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  let converted = '';
  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
    converted += chunk;
  }
  console.log(chalk.dim('\n' + '─'.repeat(60)));

  const version   = nextVersionNumber();
  const date      = new Date().toISOString().slice(0, 10);
  const filename  = `cv_v${version}_${date}.md`;
  const draftPath = path.join(CV_DRAFTS_DIR, filename);
  fs.mkdirSync(CV_DRAFTS_DIR, { recursive: true });
  fs.writeFileSync(draftPath, converted, 'utf-8');

  const saveMaster = await confirm({ message: 'Opslaan als master profiel?', default: true });
  if (saveMaster) {
    fs.copyFileSync(draftPath, MASTER_CV_PATH);
    console.log(chalk.green(`✅ Master profiel opgeslagen.\n`));
  }

  console.log(chalk.green(`\n✅ CV geïmporteerd: ${chalk.bold(draftPath)}\n`));
  return { path: draftPath, mode: 'cv', title: `CV v${version} (geïmporteerd)` };
}

async function importFromGitHub(agent: ScribeAgent, usernameArg?: string): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n🐙 GitHub import\n'));

  const username = usernameArg?.trim() || await input({
    message: 'GitHub gebruikersnaam:',
    validate: (v) => v.trim().length > 0 || 'Vereist.',
  });

  const githubContext = await fetchAndFormatGitHub(username.trim());
  if (!githubContext) return null;

  // Voeg toe aan master profiel of huidig CV?
  if (fs.existsSync(MASTER_CV_PATH)) {
    const addToMaster = await confirm({
      message: 'GitHub data toevoegen aan je master profiel?',
      default: true,
    });
    if (addToMaster) {
      const current = fs.readFileSync(MASTER_CV_PATH, 'utf-8');
      const updated = `${current}\n\n---\n\n${githubContext}`;
      fs.writeFileSync(MASTER_CV_PATH, updated, 'utf-8');
      console.log(chalk.green('✅ GitHub data toegevoegd aan master profiel.\n'));
    }
  } else {
    console.log(chalk.dim('\nGitHub data beschikbaar als context bij de volgende CV-generatie.\n'));
    console.log(githubContext);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TARGET — CV optimaliseren voor een vacature (ATS)
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVTarget(
  agent: ScribeAgent,
  currentDraft: DocumentDraft | null
): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n🎯 CV optimaliseren voor vacature\n'));

  const sourcePath = currentDraft?.path || await pickCVOrPath();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(chalk.red('❌ CV-bestand niet gevonden.\n'));
    return currentDraft;
  }

  const cvContent = fs.readFileSync(sourcePath, 'utf-8');

  // ── Vacaturetekst ─────────────────────────────────────────────────────────
  const method = await select({
    message: 'Hoe wil je de vacaturetekst aanleveren?',
    choices: [
      { name: '✏️  Tekst plakken (editor)',  value: 'editor',
        description: chalk.dim('Opent je editor — plak de volledige vacaturetekst') },
      { name: '📁 Bestand',                  value: 'file',
        description: chalk.dim('Geef het pad naar een tekstbestand met de vacature') },
    ],
  });

  let jobDescription = '';
  if (method === 'editor') {
    jobDescription = await editor({ message: 'Plak de volledige vacaturetekst:', postfix: '.txt' });
  } else {
    const filePath = await input({
      message: 'Pad naar vacature-bestand:',
      validate: (v) => fs.existsSync(expandPath(v.trim())) || 'Bestand niet gevonden',
    });
    jobDescription = fs.readFileSync(expandPath(filePath.trim()), 'utf-8');
  }

  // ── Claude ────────────────────────────────────────────────────────────────
  const prompt = `Je krijgt een CV en een vacaturetekst. Optimaliseer het CV voor deze vacature.

**Stappen:**
1. Analyseer de vacature: welke keywords, vereiste vaardigheden en tone of voice?
2. Optimaliseer het CV: verwerk ontbrekende keywords op een natuurlijke manier
3. Pas de samenvatting aan voor deze specifieke rol
4. Houd alle echte feiten intact — verzin niets
5. Verhoog het 'version' nummer in de frontmatter met 1 en vul 'target' in met de functietitel
6. Geef NA het CV een korte sectie "## Wijzigingen" met de 5 belangrijkste aanpassingen

**Vacaturetekst:**
${jobDescription}

**Huidig CV:**
${cvContent}`;

  console.log(chalk.yellow('\n🤖 CV optimaliseren...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  let optimized = '';
  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
    optimized += chunk;
  }
  console.log(chalk.dim('\n' + '─'.repeat(60)));

  // ── Backup + nieuwe versie opslaan ───────────────────────────────────────
  createBackup(sourcePath);
  const version   = nextVersionNumber();
  const date      = new Date().toISOString().slice(0, 10);
  const filename  = `cv_v${version}_${date}_targeted.md`;
  const draftPath = path.join(CV_DRAFTS_DIR, filename);
  fs.writeFileSync(draftPath, optimized, 'utf-8');

  console.log(chalk.green(`\n✅ Geoptimaliseerd CV opgeslagen: ${chalk.bold(draftPath)}\n`));
  return { path: draftPath, mode: 'cv', title: `CV v${version} (vacature-optimalisatie)` };
}

// ─────────────────────────────────────────────────────────────────────────────
//  REVIEW — laat de agent het CV reviewen
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVReview(
  agent: ScribeAgent,
  currentDraft: DocumentDraft | null
): Promise<void> {
  console.log(chalk.yellow('\n🔍 CV review\n'));

  const sourcePath = currentDraft?.path || await pickCVOrPath();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(chalk.red('❌ CV-bestand niet gevonden.\n'));
    return;
  }

  const cvContent = fs.readFileSync(sourcePath, 'utf-8');

  const prompt = `Voer een grondige review uit van dit CV. Beoordeel:

1. **Structuur & volledigheid** — ontbreken er secties? Is de volgorde logisch?
2. **Impact van bullets** — zijn de achievements meetbaar en krachtig? Begin ze met werkwoorden?
3. **ATS-vriendelijkheid** — is het formaat machine-leesbaar? Goede keywords?
4. **Samenvatting** — is die krachtig, specifiek en op de doelfunctie gericht?
5. **Taal & toon** — professioneel, actief, consistent?
6. **Prioriteiten** — geef de 3 meest impactvolle verbeterpunten

Wees concreet: geef per punt een voorbeeld van wat er beter kan en hoe.

CV:
${cvContent}`;

  console.log(chalk.yellow('\n🤖 CV reviewen...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
  }
  console.log(chalk.dim('\n' + '─'.repeat(60) + '\n'));
  console.log(chalk.dim('  → "update" om aanpassingen door te voeren\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE — sectie bijwerken
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVUpdate(
  agent: ScribeAgent,
  currentDraft: DocumentDraft | null
): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n✏️  CV bijwerken\n'));

  const sourcePath = currentDraft?.path || await pickCVOrPath();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(chalk.red('❌ CV-bestand niet gevonden.\n'));
    return currentDraft;
  }

  const content  = fs.readFileSync(sourcePath, 'utf-8');
  const headings = content.split('\n')
    .filter(l => /^#{1,3} /.test(l))
    .map(l => l.replace(/^#+\s/, '').trim())
    .filter(h => h.length > 0);

  const section = await select({
    message: 'Welke sectie wil je bijwerken?',
    choices: [
      ...headings.map(h => ({ name: h, value: h })),
      { name: '🔄 Volledig herschrijven', value: '__all__',
        description: chalk.dim('Houdt frontmatter intact, herschrijft alle content') },
    ],
  });

  const instruction = await input({
    message: 'Wat moet er veranderen?',
    validate: (v) => v.trim().length > 0 || 'Geef een instructie op.',
  });

  createBackup(sourcePath);

  const prompt = section === '__all__'
    ? `Herschrijf dit CV volledig op basis van: "${instruction}"\nHoud de YAML-frontmatter intact.\n\n${content}`
    : `Update de sectie "${section}" in dit CV op basis van: "${instruction}"\nGeef het VOLLEDIGE CV terug, verander niets aan andere secties.\n\n${content}`;

  console.log(chalk.yellow('\n🤖 CV bijwerken...\n'));
  console.log(chalk.dim('─'.repeat(60)));

  let updated = '';
  for await (const chunk of agent.chat(prompt)) {
    process.stdout.write(chunk);
    updated += chunk;
  }
  console.log(chalk.dim('\n' + '─'.repeat(60)));

  fs.writeFileSync(sourcePath, updated, 'utf-8');
  console.log(chalk.green(`\n✅ CV bijgewerkt: ${chalk.bold(sourcePath)}\n`));

  return { path: sourcePath, mode: 'cv', title: currentDraft?.title || path.basename(sourcePath, '.md') };
}

// ─────────────────────────────────────────────────────────────────────────────
//  VERSIONS — overzicht van alle CV-versies
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVVersions(): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n📚 CV-versies\n'));

  if (!fs.existsSync(CV_DRAFTS_DIR)) {
    console.log(chalk.dim('  Nog geen CV-versies aangemaakt.\n'));
    return null;
  }

  const files = fs.readdirSync(CV_DRAFTS_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('_backup_'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(chalk.dim('  Geen CV-versies gevonden.\n'));
    return null;
  }

  // Toon versies met metadata
  console.log(chalk.dim(`  Map: ${CV_DRAFTS_DIR}\n`));
  const choices = files.map(f => {
    const fullPath = path.join(CV_DRAFTS_DIR, f);
    const content  = fs.readFileSync(fullPath, 'utf-8');
    const { fm }   = parseFrontmatter(content);
    const target   = fm.target ? chalk.dim(` → ${fm.target}`) : '';
    const date     = fm.date   ? chalk.dim(` (${fm.date})`)   : '';
    return {
      name:        `${f}${date}${target}`,
      value:       fullPath,
      description: chalk.dim(`v${fm.version ?? '?'} | ${fm.name ?? ''}`),
    };
  });

  const chosen = await select({
    message: 'Kies een versie om als actief document in te laden:',
    choices: [
      ...choices,
      { name: '← Annuleren', value: '__cancel__' },
    ],
  });

  if (chosen === '__cancel__') return null;

  const { fm } = parseFrontmatter(fs.readFileSync(chosen, 'utf-8'));
  const title  = `CV v${fm.version ?? '?'} — ${fm.name ?? path.basename(chosen)}`;
  console.log(chalk.green(`\n✅ Actief: ${chalk.bold(title)}\n`));
  return { path: chosen, mode: 'cv', title };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT — Markdown + PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVExport(currentDraft: DocumentDraft | null): Promise<void> {
  console.log(chalk.yellow('\n📤 CV exporteren\n'));

  const sourcePath = currentDraft?.path || await pickCVOrPath();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(chalk.red('❌ CV-bestand niet gevonden.\n'));
    return;
  }

  const format = await select({
    message: 'Exportformaat:',
    choices: [
      { name: '📄 PDF  — print-ready, moderne layout', value: 'pdf',
        description: chalk.dim('Gegenereerd via Puppeteer/Chromium op basis van je CV-Markdown') },
      { name: '📝 Markdown — bronbestand',              value: 'markdown',
        description: chalk.dim('Kopieert het .md bestand naar je output-map') },
      { name: '📄 Beide',                               value: 'both' },
    ],
  });

  const config     = loadConfig();
  const defaultDir = config.outputPaths.cv;
  const destDir    = expandPath(await input({ message: 'Doelmap:', default: defaultDir }));
  fs.mkdirSync(destDir, { recursive: true });

  const baseName = path.basename(sourcePath, '.md');

  if (format === 'markdown' || format === 'both') {
    const dest = path.join(destDir, `${baseName}.md`);
    fs.copyFileSync(sourcePath, dest);
    console.log(chalk.green(`✅ Markdown: ${dest}`));
  }

  if (format === 'pdf' || format === 'both') {
    const pdfPath = path.join(destDir, `${baseName}.pdf`);
    const spinner = ora('PDF genereren via Chromium...').start();
    try {
      await generateCVPdf(sourcePath, pdfPath);
      spinner.succeed(chalk.green(`PDF: ${pdfPath}`));
    } catch (err: any) {
      spinner.fail(chalk.red(`PDF-generatie mislukt: ${err.message}`));
    }
  }

  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
//  SIDEBAR EDIT — Talen, Vaardigheden, Persoonlijke eigenschappen, Hobby's
// ─────────────────────────────────────────────────────────────────────────────

export async function runCVSidebarEdit(
  currentDraft: DocumentDraft | null
): Promise<DocumentDraft | null> {
  console.log(chalk.yellow('\n📝 Sidebar sectie bewerken\n'));

  const sourcePath = currentDraft?.path || await pickCVOrPath();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(chalk.red('❌ CV-bestand niet gevonden.\n'));
    return currentDraft;
  }

  const rawContent = fs.readFileSync(sourcePath, 'utf-8');
  const { body }   = parseFrontmatter(rawContent);
  const sections   = parseSections(body);

  const editableSections = sections.filter(
    s => EDITABLE_SIDEBAR.has(s.title.toLowerCase().trim())
  );

  if (editableSections.length === 0) {
    console.log(chalk.yellow('\nGeen bewerkbare sidebar-secties gevonden in dit CV.'));
    console.log(chalk.dim("  Verwacht: Talen, Vaardigheden, Persoonlijke eigenschappen, Hobby's (en Interesses)\n"));
    return currentDraft;
  }

  const sectionChoice = await select({
    message: 'Welke sectie wil je bewerken?',
    choices: [
      ...editableSections.map(s => ({
        name:        s.title,
        value:       s.title,
        description: chalk.dim(`${parseSidebarItems(s.rawMd).length} item(s)`),
      })),
      { name: '← Terug', value: '__back__' },
    ],
  });

  if (sectionChoice === '__back__') return currentDraft;

  const section = editableSections.find(s => s.title === sectionChoice)!;
  const isHobby = isHobbyTitle(section.title);
  let   items   = parseSidebarItems(section.rawMd);

  // ── Bewerkingsloop ───────────────────────────────────────────────────────
  let saved = false;
  while (true) {
    console.log(chalk.yellow(`\n📝 ${section.title}\n`));

    if (items.length === 0) {
      console.log(chalk.dim('  (geen items)\n'));
    } else {
      items.forEach((item, i) => {
        if (isHobby) {
          console.log(`  ${chalk.bold((i + 1) + '.')} ${item.label}`);
        } else {
          const bar = renderLevelBar(item.level);
          console.log(`  ${chalk.bold((i + 1) + '.')} ${item.label.padEnd(36)} ${bar}  ${item.level}%`);
        }
      });
    }
    console.log();

    const action = await select({
      message: 'Wat wil je doen?',
      choices: [
        { name: '➕ Item toevoegen',           value: 'add'    },
        { name: '✏️  Item bewerken',            value: 'edit',   disabled: items.length === 0 },
        { name: '🗑️  Item verwijderen',         value: 'delete', disabled: items.length === 0 },
        { name: '✅ Opslaan en afsluiten',      value: 'done'   },
        { name: '↩️  Annuleren (niet opslaan)', value: 'cancel' },
      ],
    });

    if (action === 'done') {
      createBackup(sourcePath);
      const updated = rebuildFileWithUpdatedSection(rawContent, section.title, items, isHobby);
      fs.writeFileSync(sourcePath, updated, 'utf-8');
      console.log(chalk.green(`\n✅ Sectie "${section.title}" opgeslagen.\n`));
      saved = true;
      break;

    } else if (action === 'cancel') {
      console.log(chalk.dim('\nAnnuleren — geen wijzigingen opgeslagen.\n'));
      break;

    } else if (action === 'add') {
      const label = await input({
        message: 'Naam van het item:',
        validate: v => v.trim().length > 0 || 'Vereist.',
      });
      const level = isHobby ? 70 : await pickLevel();
      items.push({ label: label.trim(), level });

    } else if (action === 'edit') {
      const idx = await pickItemIndex(items, 'Kies het item om te bewerken:');
      if (idx >= 0) {
        const newLabel = await input({
          message: 'Nieuwe naam (Enter = behoud huidige):',
          default: items[idx].label,
        });
        items[idx].label = newLabel.trim() || items[idx].label;
        if (!isHobby) {
          items[idx].level = await pickLevel(items[idx].level);
        }
      }

    } else if (action === 'delete') {
      const idx = await pickItemIndex(items, 'Kies het item om te verwijderen:');
      if (idx >= 0) {
        const confirmed = await confirm({
          message: `Verwijder "${items[idx].label}"?`,
          default: false,
        });
        if (confirmed) {
          const removed = items.splice(idx, 1)[0];
          console.log(chalk.green(`  ✅ "${removed.label}" verwijderd.\n`));
        }
      }
    }
  }

  return currentDraft;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hulpfuncties
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndFormatGitHub(username: string): Promise<string> {
  const spinner = ora(`GitHub data ophalen voor @${username}...`).start();
  try {
    const [profile, repos] = await Promise.all([
      fetchGitHubProfile(username),
      fetchGitHubRepos(username),
    ]);
    spinner.succeed(chalk.green(`GitHub: ${repos.length} repos opgehaald voor @${username}`));
    return formatGitHubContext(profile, repos);
  } catch (err: any) {
    spinner.fail(chalk.red(`GitHub fout: ${err.message}`));
    return '';
  }
}

function buildGeneratePrompt(data: {
  name: string; jobTitle: string; email: string; phone: string;
  linkedin: string; github: string; location: string; date: string;
  version: number; masterContext: string; extraContext: string; jobDescription: string;
}): string {
  const hasJob = data.jobDescription.trim().length > 0;

  return `Genereer een professioneel CV in het exacte ScribeAI Markdown-formaat (met YAML-frontmatter).

**Contactgegevens voor de frontmatter:**
- name: "${data.name}"
- title: "${data.jobTitle}"
- email: "${data.email}"
- phone: "${data.phone}"
- linkedin: "${data.linkedin}"
- github: "${data.github}"
- location: "${data.location}"
- version: ${data.version}
- date: "${data.date}"
- target: "${hasJob ? data.jobTitle : ''}"

${data.masterContext ? `**Master profiel (basis voor dit CV):**\n${data.masterContext}\n` : ''}
${data.extraContext  ? `**Aanvullende informatie / werkervaring:**\n${data.extraContext}\n` : ''}
${hasJob ? `**Vacaturetekst (optimaliseer het CV hierop):**\n${data.jobDescription}\n` : ''}

**Richtlijnen:**
- Gebruik ALTIJD het ScribeAI CV-formaat met YAML-frontmatter
- Schrijf impact-gedreven bullets: meetbare resultaten, sterke werkwoorden
- ${hasJob ? 'Verwerk keywords uit de vacature op een natuurlijke manier' : 'Schrijf voor een algemeen professioneel publiek'}
- Selecteer de meest relevante ervaring — max. 4-6 jobs
- Houd het compact: max. 2 A4-pagina's als PDF`;
}

async function pickCVOrPath(): Promise<string> {
  if (!fs.existsSync(CV_DRAFTS_DIR)) {
    const p = await input({ message: 'Pad naar CV-bestand:' });
    return expandPath(p.trim());
  }

  const files = fs.readdirSync(CV_DRAFTS_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('_backup_'))
    .sort().reverse()
    .map(f => ({ name: f, value: path.join(CV_DRAFTS_DIR, f) }));

  if (files.length === 0) {
    const p = await input({ message: 'Pad naar CV-bestand:' });
    return expandPath(p.trim());
  }

  const choice = await select({
    message: 'Kies een CV:',
    choices: [
      ...files.map(f => ({ ...f, description: chalk.dim(f.value) })),
      { name: '📁 Ander pad invoeren', value: '__custom__' },
    ],
  });

  if (choice === '__custom__') {
    const p = await input({ message: 'Volledig pad:' });
    return expandPath(p.trim());
  }
  return choice;
}

function nextVersionNumber(): number {
  if (!fs.existsSync(CV_DRAFTS_DIR)) return 1;
  const files = fs.readdirSync(CV_DRAFTS_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('_backup_'));
  const versions = files.map(f => {
    const m = f.match(/cv_v(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}

function expandPath(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

// ── Level-picker helpers ──────────────────────────────────────────────────────

const LEVEL_CHOICES = [
  { name: `${'░'.repeat(12)}   0% — Geen`,              value: 0   },
  { name: `${'█'.repeat(2)}${'░'.repeat(10)}  20% — Basis`,          value: 20  },
  { name: `${'█'.repeat(4)}${'░'.repeat(8)}  40% — Gemiddeld`,      value: 40  },
  { name: `${'█'.repeat(6)}${'░'.repeat(6)}  60% — Gevorderd`,      value: 60  },
  { name: `${'█'.repeat(8)}${'░'.repeat(4)}  80% — Goed`,           value: 80  },
  { name: `${'█'.repeat(12)}         100% — Expert / Moedertaal`,   value: 100 },
];

async function pickLevel(currentLevel = 70): Promise<number> {
  const rounded = Math.round(currentLevel / 20) * 20;
  return select({
    message: 'Niveau:',
    choices: LEVEL_CHOICES,
    default: rounded,
  });
}

function renderLevelBar(level: number): string {
  const filled = Math.round(level / 100 * 12);
  const empty  = 12 - filled;
  return chalk.blue('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

async function pickItemIndex(items: SidebarItem[], message: string): Promise<number> {
  return select({
    message,
    choices: [
      ...items.map((item, i) => ({ name: item.label, value: i })),
      { name: '← Annuleren', value: -1 },
    ],
  });
}

// ── Sectie terugschrijven naar het CV-bestand ──────────────────────────────────

function rebuildFileWithUpdatedSection(
  rawContent: string,
  sectionTitle: string,
  items: SidebarItem[],
  isHobby: boolean
): string {
  // Preserve original frontmatter block exactly
  const fmMatch = rawContent.match(/^---\n[\s\S]*?\n---\n?/);
  const fmBlock = fmMatch ? fmMatch[0] : '';
  const body    = rawContent.slice(fmBlock.length);

  // Split body on section boundaries ("## title"), keeping the delimiter
  const parts = body.split(/(?=^## )/m);

  const updatedParts = parts.map(part => {
    if (!part.trim()) return part;
    const titleMatch = part.match(/^## (.+)/);
    if (!titleMatch) return part;
    if (titleMatch[1].trim().toLowerCase() !== sectionTitle.toLowerCase().trim()) return part;

    // Rebuild this section's content
    const lines = items.map(item =>
      isHobby ? `- ${item.label}` : `- ${item.label} (${item.level})`
    );
    return `## ${titleMatch[1].trim()}\n\n${lines.join('\n')}\n`;
  });

  return fmBlock + updatedParts.join('');
}

// ── Frontmatter field injecteren (post-AI) ────────────────────────────────────

function injectFrontmatterField(content: string, key: string, value: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return content;
  const fmText  = match[1];
  const afterFm = content.slice(match[0].length);
  const keyRegex = new RegExp(`^${key}:.*$`, 'm');
  const newFm = keyRegex.test(fmText)
    ? fmText.replace(keyRegex, `${key}: "${value}"`)
    : fmText + `\n${key}: "${value}"`;
  return `---\n${newFm}\n---\n${afterFm}`;
}
