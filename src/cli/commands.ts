// src/cli/commands.ts
import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import { ScribeAgent } from '../core/agent';
import { AgentMode, ModelAlias, MODEL_LABELS, DocumentDraft } from '../core/types';
import { getAvailableModes } from '../modes';
import { loadConfig, saveConfig, getConfigPath } from '../config/manager';
import { runGenerate, runOutline, runUpdate, runExport } from '../workflows/report';
import {
  runCVGenerate, runCVImport, runCVTarget, runCVReview,
  runCVUpdate, runCVVersions, runCVExport, runCVSidebarEdit,
} from '../workflows/cv';

export interface CLIState {
  agent: ScribeAgent;
  currentDocument: DocumentDraft | null;
}

export async function handleCommand(input: string, state: CLIState): Promise<CLIState> {
  const parts = input.trim().split(/\s+/);
  const cmd   = parts[0]?.toLowerCase() ?? '';
  const args  = parts.slice(1);

  switch (cmd) {
    case '':
      break;

    // ── Modus wisselen ──────────────────────────────────────────────────────
    case 'mode': {
      const modes = getAvailableModes();
      const newMode = args[0] as AgentMode | undefined;
      const validModes = modes.map(m => m.name);

      if (!newMode || !validModes.includes(newMode)) {
        console.log(chalk.yellow('\nBeschikbare modi:\n'));
        for (const m of modes) {
          const active = m.name === state.agent.getConfig().mode ? chalk.green(' ← actief') : '';
          console.log(`  ${chalk.bold(m.name.padEnd(10))} ${m.label}${active}`);
          console.log(`  ${' '.repeat(10)} ${chalk.dim(m.description)}`);
        }
        console.log();
        break;
      }

      state.agent.setMode(newMode);
      const def = modes.find(m => m.name === newMode)!;
      console.log(chalk.green(`\n✅ Modus: ${def.label}\n`));
      break;
    }

    // ── Model wisselen ──────────────────────────────────────────────────────
    case 'model': {
      const newModel = args[0] as ModelAlias | undefined;
      const validModels: ModelAlias[] = ['sonnet', 'haiku', 'opus'];

      if (!newModel || !validModels.includes(newModel)) {
        console.log(chalk.yellow(`\nGebruik: model <${validModels.join('|')}>\n`));
        for (const m of validModels) {
          const active = m === state.agent.getConfig().model ? chalk.green(' ← actief') : '';
          console.log(`  ${chalk.bold(m.padEnd(10))} ${MODEL_LABELS[m]}${active}`);
        }
        console.log();
        break;
      }

      state.agent.setModel(newModel);
      console.log(chalk.green(`\n✅ Model: ${MODEL_LABELS[newModel]}\n`));
      break;
    }

    // ── Generate — nieuw document ────────────────────────────────────────────
    case 'generate':
    case 'new': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'report') {
        const draft = await runGenerate(state.agent);
        if (draft) state = { ...state, currentDocument: draft };
      } else if (mode === 'cv') {
        const draft = await runCVGenerate(state.agent);
        if (draft) state = { ...state, currentDocument: draft };
      } else {
        console.log(chalk.yellow(`\n"generate" is beschikbaar in: report, cv`));
        console.log(chalk.dim('  Wissel modus met: mode report  of  mode cv\n'));
      }
      break;
    }

    // ── Import — bestaand document importeren (alleen CV-modus) ─────────────
    case 'import': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'cv') {
        const draft = await runCVImport(state.agent, args);
        if (draft) state = { ...state, currentDocument: draft };
      } else {
        console.log(chalk.yellow(`\n"import" is beschikbaar in cv-modus.`));
        console.log(chalk.dim('  Wissel modus met: mode cv\n'));
      }
      break;
    }

    // ── Target — CV optimaliseren voor vacature ──────────────────────────────
    case 'target': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'cv') {
        const draft = await runCVTarget(state.agent, state.currentDocument);
        if (draft) state = { ...state, currentDocument: draft };
      } else {
        console.log(chalk.yellow(`\n"target" is beschikbaar in cv-modus.\n`));
      }
      break;
    }

    // ── Review — CV laten reviewen ───────────────────────────────────────────
    case 'review': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'cv') {
        await runCVReview(state.agent, state.currentDocument);
      } else {
        console.log(chalk.yellow(`\n"review" is beschikbaar in cv-modus.\n`));
      }
      break;
    }

    // ── Versions — CV-versies beheren ────────────────────────────────────────
    case 'versions': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'cv') {
        const draft = await runCVVersions();
        if (draft) state = { ...state, currentDocument: draft };
      } else {
        console.log(chalk.yellow(`\n"versions" is beschikbaar in cv-modus.\n`));
      }
      break;
    }

    // ── Sidebar — bewerkbare sidebar-secties van het actieve CV ──────────────
    case 'sidebar': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'cv') {
        await runCVSidebarEdit(state.currentDocument);
      } else {
        console.log(chalk.yellow(`\n"sidebar" is beschikbaar in cv-modus.\n`));
      }
      break;
    }

    // ── Outline ──────────────────────────────────────────────────────────────
    case 'outline': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'report') {
        await runOutline(state.agent);
      } else {
        console.log(chalk.yellow(`\n"outline" is beschikbaar in report-modus.\n`));
      }
      break;
    }

    // ── Update — bestaand document bijwerken ─────────────────────────────────
    case 'update': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'report') {
        const draft = await runUpdate(state.agent, state.currentDocument);
        if (draft) state = { ...state, currentDocument: draft };
      } else if (mode === 'cv') {
        const draft = await runCVUpdate(state.agent, state.currentDocument);
        if (draft) state = { ...state, currentDocument: draft };
      } else {
        console.log(chalk.yellow(`\n"update" is beschikbaar in: report, cv\n`));
      }
      break;
    }

    // ── Export ───────────────────────────────────────────────────────────────
    case 'export': {
      const mode = state.agent.getConfig().mode;
      if (mode === 'report') {
        await runExport(state.currentDocument);
      } else if (mode === 'cv') {
        await runCVExport(state.currentDocument);
      } else {
        console.log(chalk.yellow(`\n"export" is beschikbaar in: report, cv\n`));
      }
      break;
    }

    // ── Config bekijken / aanpassen ──────────────────────────────────────────
    case 'config': {
      const subCmd = args[0]?.toLowerCase();

      if (subCmd === 'set') {
        await runConfigWizard();
        break;
      }

      const config = loadConfig();
      console.log(chalk.yellow(`\n📁 Config: ${getConfigPath()}\n`));
      console.log(`  ${chalk.dim('Obsidian vault:')}      ${config.obsidianVaultPath || chalk.dim('(niet ingesteld)')}`);
      console.log(`  ${chalk.dim('Export formaat:')}      ${config.defaultExportFormat}`);
      console.log(`  ${chalk.dim('Standaard model:')}     ${MODEL_LABELS[config.defaultModel]}`);
      console.log(`  ${chalk.dim('Output rapporten:')}    ${config.outputPaths.reports}`);
      console.log(`  ${chalk.dim('Output CV:')}           ${config.outputPaths.cv}`);
      console.log(`  ${chalk.dim('Naam:')}                ${config.profile.name || chalk.dim('(niet ingesteld)')}`);
      console.log(`  ${chalk.dim('Email:')}               ${config.profile.email || chalk.dim('(niet ingesteld)')}`);
      console.log(`  ${chalk.dim('LinkedIn:')}            ${config.profile.linkedin || chalk.dim('(niet ingesteld)')}`);
      console.log(`  ${chalk.dim('GitHub:')}              ${config.profile.github || chalk.dim('(niet ingesteld)')}`);
      console.log(chalk.dim('\n  Typ "config set" om instellingen te wijzigen.\n'));
      break;
    }

    // ── Status ──────────────────────────────────────────────────────────────
    case 'status': {
      console.log(`\n📊 ${state.agent.getStatus()}`);
      if (state.currentDocument) {
        console.log(`📄 Document:  ${chalk.bold(state.currentDocument.title)}`);
        console.log(`   Locatie:   ${chalk.dim(state.currentDocument.path)}`);
      }
      console.log();
      break;
    }

    // ── Flows ────────────────────────────────────────────────────────────────
    case 'flows': {
      const modeDef = getAvailableModes().find(m => m.name === state.agent.getConfig().mode);
      if (!modeDef || modeDef.workflows.length === 0) {
        console.log(chalk.yellow(`\nGeen workflows beschikbaar in ${state.agent.getConfig().mode}-modus.\n`));
        break;
      }
      const flow = await select({
        message: `Kies een workflow (${modeDef.label}):`,
        choices: [
          ...modeDef.workflows.map(w => ({ name: w, value: w })),
          { name: '← Terug', value: '__back__' },
        ],
      });
      if (flow === '__back__') break;

      // Dispatch workflow naar de juiste commando
      const flowMap: Record<string, string> = {
        'Nieuw rapport':              'generate',
        'Dataset samenvatten':        'generate',
        'Bestaand rapport updaten':   'update',
      };
      const mappedCmd = flowMap[flow];
      if (mappedCmd) {
        return handleCommand(mappedCmd, state);
      }
      break;
    }

    // ── Clear ─────────────────────────────────────────────────────────────────
    case 'clear':
      console.clear();
      break;

    // ── Help ──────────────────────────────────────────────────────────────────
    case 'help':
      printHelp(state.agent.getConfig().mode, state.currentDocument);
      break;

        // ── History wissen ────────────────────────────────────────────────────────
    case 'history': {
      const subCmd = args[0]?.toLowerCase();
      if (subCmd === 'clear') {
        const target = args[1] as AgentMode | undefined;
        state.agent.history.clear(target);
        console.log(chalk.green(target
          ? `\n✅ History voor "${target}" gewist.\n`
          : '\n✅ Alle history gewist.\n'
        ));
      } else {
        console.log(chalk.dim('\n  history clear          — wis history actieve modus'));
        console.log(chalk.dim('  history clear [modus]  — wis history van specifieke modus\n'));
      }
      break;
    }

    // ── Afsluiten ─────────────────────────────────────────────────────────────
    case 'exit':
    case 'quit':
      console.log(chalk.yellow('\n👋 Tot ziens!\n'));
      process.exit(0);
      break;

    // ── Vrije chat → agent ────────────────────────────────────────────────────
    default: {
      await streamChat(input, state);
    }
  }

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────

async function streamChat(message: string, state: CLIState): Promise<void> {
  const mode    = state.agent.getConfig().mode;
  const history = state.agent.history;

  // Bouw de prompt op: historische context + huidig document + nieuw bericht
  const historyCtx = history.buildContext(mode);

  let docCtx = '';
  if (state.currentDocument) {
    docCtx = `[Actief document: "${state.currentDocument.title}" ` +
             `(${state.currentDocument.mode}-modus), pad: ${state.currentDocument.path}]\n\n`;
  }

  const fullPrompt = [historyCtx, docCtx, message].filter(Boolean).join('\n');

  // Sla het gebruikersbericht op vóór het streamen
  history.add(mode, 'user', message);

  process.stdout.write('\n🤖 ');
  let response = '';
  for await (const chunk of state.agent.chat(fullPrompt)) {
    process.stdout.write(chunk);
    response += chunk;
  }
  process.stdout.write('\n\n');

  // Sla het antwoord op en persisteer (history.add kapt af indien nodig)
  history.add(mode, 'assistant', response);
  history.save(mode);
}

async function runConfigWizard(): Promise<void> {
  const current = loadConfig();
  console.log(chalk.yellow('\n⚙️  ScribeAI Instellingen\n'));
  console.log(chalk.dim('  Druk Enter om de huidige waarde te bewaren.\n'));

  const obsidianVaultPath = await input({
    message: 'Pad naar Obsidian vault:',
    default: current.obsidianVaultPath || '',
  });

  const defaultExportFormat = await select({
    message: 'Standaard exportformaat:',
    choices: [
      { name: 'Markdown  (.md) — altijd de bron', value: 'markdown' },
      { name: 'PDF       (.pdf)',                  value: 'pdf'      },
      { name: 'Word      (.docx)',                 value: 'docx'     },
    ],
    default: current.defaultExportFormat,
  }) as 'markdown' | 'pdf' | 'docx';

  const defaultModel = await select({
    message: 'Standaard Claude model:',
    choices: [
      { name: MODEL_LABELS.sonnet, value: 'sonnet', description: chalk.dim('Aanbevolen — goede balans tussen kwaliteit en snelheid') },
      { name: MODEL_LABELS.haiku,  value: 'haiku',  description: chalk.dim('Snelste en goedkoopste model') },
      { name: MODEL_LABELS.opus,   value: 'opus',   description: chalk.dim('Meest capabele model — langzamer') },
    ],
    default: current.defaultModel,
  }) as ModelAlias;

  const outputReports = await input({
    message: 'Output map — rapporten:',
    default: current.outputPaths.reports,
  });

  const outputCv = await input({
    message: "Output map — CV's:",
    default: current.outputPaths.cv,
  });

  console.log(chalk.dim('\n  Profielgegevens (worden gebruikt als standaard bij CV en rapporten)\n'));

  const profileName     = await input({ message: 'Jouw naam:',          default: current.profile.name     || '' });
  const profileEmail    = await input({ message: 'Email:',               default: current.profile.email    || '' });
  const profilePhone    = await input({ message: 'Telefoonnummer:',      default: current.profile.phone    || '' });
  const profileLinkedin = await input({ message: 'LinkedIn URL:',        default: current.profile.linkedin || '' });
  const profileGithub   = await input({ message: 'GitHub gebruikersnaam:', default: current.profile.github || '' });

  saveConfig({
    ...current,
    obsidianVaultPath,
    defaultExportFormat,
    defaultModel,
    outputPaths: { reports: outputReports, cv: outputCv },
    profile: {
      name:     profileName,
      email:    profileEmail,
      phone:    profilePhone,
      linkedin: profileLinkedin,
      github:   profileGithub,
    },
  });

  console.log(chalk.green('\n✅ Instellingen opgeslagen.\n'));
}

function printHelp(currentMode: AgentMode, currentDoc: DocumentDraft | null): void {
  const isReport = currentMode === 'report';
  const isCV     = currentMode === 'cv';

  const docSection = isReport
    ? `${chalk.bold('Report-modus commando\'s:')}
  ${chalk.yellow('generate')}          Nieuw rapport genereren
  ${chalk.yellow('outline')}           Alleen outline/structuur genereren
  ${chalk.yellow('update')}            Rapport bijwerken
  ${chalk.yellow('export')}            Exporteren naar Markdown`
    : isCV
    ? `${chalk.bold('CV-modus commando\'s:')}
  ${chalk.yellow('generate')}          Nieuw CV genereren (met template-keuze)
  ${chalk.yellow('import file')}       Bestaand CV uploaden (.md / .txt)
  ${chalk.yellow('import github')}     GitHub profiel importeren
  ${chalk.yellow('target')}            CV optimaliseren voor een vacature (ATS)
  ${chalk.yellow('review')}            CV laten reviewen door de agent
  ${chalk.yellow('update')}            CV-sectie bijwerken
  ${chalk.yellow('versions')}          Alle CV-versies tonen en wisselen
  ${chalk.yellow('sidebar')}           Talen, Vaardigheden en Hobbys bewerken
  ${chalk.yellow('export')}            Exporteren naar PDF of Markdown`
    : `${chalk.bold('Algemene commando\'s:')}
  ${chalk.yellow('generate')}          Nieuw document (schakel naar report of cv modus)`;

  console.log(`
${docSection}

${chalk.bold('Navigatie:')}
  ${chalk.yellow('mode [naam]')}       Wissel modus  ${chalk.dim('(general | report | cv | notes)')}
  ${chalk.yellow('model [naam]')}      Wissel model  ${chalk.dim('(sonnet | haiku | opus)')}
  ${chalk.yellow('flows')}             Workflow-menu voor de actieve modus
  ${chalk.yellow('status')}            Actieve modus, model en huidig document
  ${chalk.yellow('config')}            Toon instellingen
  ${chalk.yellow('config set')}        Instellingen wijzigen
  ${chalk.yellow('history clear')}     Wis gesprekshistory voor actieve modus
  ${chalk.yellow('clear')}             Wis het scherm
  ${chalk.yellow('help')}              Dit helpscherm
  ${chalk.yellow('exit')}              ScribeAI afsluiten
${currentDoc ? `\n${chalk.bold('Huidig document:')}  ${chalk.dim(currentDoc.title)}` : ''}

${chalk.dim('Of typ vrij tekst voor een gesprek met de agent.')}
`);
}
