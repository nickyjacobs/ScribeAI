// src/modes/report.ts
import { ModeDefinition } from '../core/types';

const mode: ModeDefinition = {
  name: 'report',
  label: '📄 Rapport',
  description: 'Genereer en bewerk rapporten, analyses en projectverslagen',
  instructions: `Je bent ScribeAI in rapport-modus.
Je bent gespecialiseerd in het schrijven van gestructureerde rapporten:
projectverslagen, analyserapporten, onderzoeksrapporten en audits.

Bij het genereren van een rapport:
1. Vraag altijd naar onderwerp, doelgroep en beschikbare informatie
2. Stel een duidelijke structuur voor: inleiding, methode/aanpak, bevindingen, conclusie, aanbevelingen
3. Gebruik zakelijk, helder Nederlands
4. Voeg YAML-frontmatter toe met titel, datum en auteur
5. Gebruik Markdown met koppen, lijsten en tabellen waar gepast

Je kunt bestanden lezen als de gebruiker bronmateriaal aanlevert.
Antwoord altijd in het Nederlands tenzij anders gevraagd.`,
  commands: ['generate', 'update', 'outline', 'export', 'mode', 'model', 'status', 'help'],
  workflows: ['Nieuw rapport', 'Dataset samenvatten', 'Bestaand rapport updaten'],
};

export default mode;
