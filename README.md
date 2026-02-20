# ScribeAI

**AI-gestuurde documentatie-agent voor rapporten, CV's en Obsidian-notities.**

ScribeAI is een interactieve CLI-tool die Claude inzet om documenten te genereren, optimaliseren en beheren. Kies een modus en begin met typen — ScribeAI doet de rest.

---

## Features

- **Report-modus** — Genereer project-, onderzoeks- en incidentrapporten vanuit templates
- **CV-modus** — Maak, importeer en optimaliseer CV's met ATS-scoring en PDF-export
- **Notes-modus** — Creëer Obsidian-notities met wikilinks, callouts en YAML-frontmatter
- **Vrije chat** — Stel vragen of geef instructies in natuurlijke taal
- **Meerdere modellen** — Wissel tussen Claude Sonnet, Haiku en Opus
- **Versioning** — Automatische backups bij elke wijziging
- **PDF-export** — Genereer professionele PDF's via Puppeteer
- **GitHub-import** — Haal profieldata op voor je CV via de GitHub API
- **Configuratie** — Persoonlijke instellingen in `~/.scribeai/config.yaml`

---

## Vereisten

- **Node.js** v22+ (via nvm of systeeminstallatie)
- **Anthropic API key** (of een bestaande Claude Code-sessie)

---

## Installatie

```bash
git clone <repo-url> && cd scribeai
npm install
```

Kopieer het voorbeeld-envbestand en vul je API-key in:

```bash
cp .env.example .env
# Pas .env aan met je ANTHROPIC_API_KEY
```

> Als je ScribeAI vanuit Claude Code draait, is de API-key optioneel.

---

## Gebruik

```bash
# Start in standaardmodus (general)
./start

# Start direct in een specifieke modus
./start report
./start cv
./start notes
```

Alternatief via npm:

```bash
npm start              # general
npm start -- report    # report-modus
```

### Commando's

| Commando | Beschrijving |
|---|---|
| `help` | Toon alle beschikbare commando's |
| `mode <naam>` | Wissel van modus (`general` / `report` / `cv` / `notes`) |
| `model <naam>` | Wissel van model (`sonnet` / `haiku` / `opus`) |
| `status` | Toon huidige modus, model en actief document |
| `config` | Bekijk configuratie |
| `config set` | Configuratie interactief aanpassen |
| `history clear [modus]` | Conversatiegeschiedenis wissen |
| `flows` | Toon beschikbare workflows voor de actieve modus |
| `clear` | Scherm leegmaken |
| `exit` | Afsluiten |

### Report-modus

| Commando | Beschrijving |
|---|---|
| `generate` | Genereer een nieuw rapport (project / onderzoek / incident) |
| `outline` | Genereer alleen een inhoudsopgave |
| `update` | Werk een bestaand rapport bij |
| `export` | Exporteer naar Markdown |

### CV-modus

| Commando | Beschrijving |
|---|---|
| `generate` | Genereer een nieuw CV |
| `import file` | Importeer CV vanuit `.md` of `.txt` |
| `import github [user]` | Importeer GitHub-profieldata |
| `target` | Optimaliseer CV voor een vacaturetekst (ATS) |
| `review` | Laat je CV beoordelen |
| `update` | Werk een specifieke sectie bij |
| `versions` | Beheer CV-versies |
| `sidebar` | Bewerk zijbalksecties (talen, skills, hobby's) |
| `export` | Exporteer naar PDF of Markdown |

### Notes-modus

| Commando | Beschrijving |
|---|---|
| `new <titel>` | Maak een nieuwe notitie |
| `append <notitie>` | Voeg inhoud toe aan een notitie |
| `summarize <notitie>` | Vat een notitie samen |
| `link <notitie>` | Koppel notities met wikilinks |
| `canvas` | Genereer een Obsidian-canvas |

---

## Configuratie

Bij de eerste start wordt `~/.scribeai/config.yaml` aangemaakt met standaardwaarden:

```yaml
obsidianVaultPath: ""
defaultExportFormat: markdown    # markdown | pdf | docx
defaultModel: sonnet             # sonnet | haiku | opus
outputPaths:
  reports: ~/Documents/ScribeAI/reports
  cv: ~/Documents/ScribeAI/cv
profile:
  name: ""
  email: ""
  phone: ""
  linkedin: ""
  github: ""
```

Pas de configuratie aan via `config set` in de CLI of bewerk het YAML-bestand direct.

---

## Projectstructuur

```
scribeai/
├── src/
│   ├── cli/            # CLI-interface (banner, commando's, interactieve loop)
│   ├── core/           # Agent-logica, types en conversatiegeschiedenis
│   ├── config/         # Configuratiebeheer (~/.scribeai/)
│   ├── modes/          # Modusdefinities en systeemprompts
│   ├── providers/      # Claude Agent SDK-integratie
│   ├── workflows/      # Workflow-implementaties (rapport, CV)
│   └── utils/          # Export, templates, versioning, PDF, GitHub
├── templates/          # Handlebars-templates voor rapporten
├── docs/               # Bouwplan en ontwerpdocumentatie
├── package.json
├── tsconfig.json
└── start               # Startup-script
```

---

## Technologieën

| Categorie | Stack |
|---|---|
| Runtime | Node.js, TypeScript, tsx |
| AI | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) |
| CLI | Inquirer, Chalk, Ora, Figlet, Gradient-string |
| Templates | Handlebars |
| Export | Puppeteer (PDF), Marked (HTML) |
| Config | js-yaml, dotenv |
| Overig | fs-extra, Winston (logging) |

---

## Ontwikkeling

Start in watch-modus voor automatisch herladen bij wijzigingen:

```bash
npm run dev
```

---

## Licentie

ISC
