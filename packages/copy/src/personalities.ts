import type { CopyCatalog } from '@git-wrapped/contracts';

export const personalities: CopyCatalog['personalities'] = {
  architect: {
    name: 'L’Architetto',
    description: 'MR monumentali e strutture con fondamenta. Il tuo diff ha una planimetria.',
    emoji: '🏛️',
  },
  firefighter: {
    name: 'Il Pompiere',
    description: 'Dove c’è fumo, c’è un hotfix. Arrivi con l’idrante prima dell’allarme.',
    emoji: '🚒',
  },
  gardener: {
    name: 'Il Giardiniere',
    description: 'Poti, rifattorizzi, sradichi il superfluo. Il repo fiorisce dove passi.',
    emoji: '🌱',
  },
  diplomat: {
    name: 'Il Diplomatico',
    description:
      'Review gentili, commenti utili, emoji a pioggia. Trattati di pace a colpi di LGTM.',
    emoji: '🕊️',
  },
  sprinter: {
    name: 'Lo Sprinter',
    description: 'Commit piccoli e frequenti, come passi svelti. Il tuo log è una staccionata.',
    emoji: '⚡',
  },
  philosopher: {
    name: 'Il Filosofo',
    description: 'Ogni messaggio di commit è un saggio. Il perché viene prima del cosa.',
    emoji: '🦉',
  },
  night_creature: {
    name: 'La Creatura della notte',
    description: 'Il tuo orario preferito è “dopo cena, molto dopo”. Il buio è il tuo editor.',
    emoji: '🌙',
  },
  metronome: {
    name: 'Il Metronomo',
    description: 'Stessa ora, stesso ritmo, ogni giorno. Il team ti usa per regolare l’orologio.',
    emoji: '🎼',
  },
};
