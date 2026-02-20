// src/modes/general.ts
import { ModeDefinition } from '../core/types';

const mode: ModeDefinition = {
  name: 'general',
  label: '✏️  Algemeen',
  description: 'Vrije modus voor vragen, snelle documenten en algemene taken',
  instructions: `Je bent ScribeAI, een AI-assistent gespecialiseerd in documentatie en schrijftaken.
Je helpt met het opstellen, verbeteren en beheren van documenten.
Antwoord altijd in het Nederlands tenzij de gebruiker om een andere taal vraagt.
Wees behulpzaam, beknopt en professioneel.
Je kunt ook bestandssysteem-operaties uitvoeren als de gebruiker dit vraagt.`,
  commands: ['mode', 'model', 'status', 'config', 'help', 'clear', 'exit'],
  workflows: [],
};

export default mode;
