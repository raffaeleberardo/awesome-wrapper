import type { CopyCatalog } from '@git-wrapped/contracts';

export const awards: CopyCatalog['awards'] = {
  best_duet: {
    title: 'Miglior coppia non protagonista',
    description: '{winner}: {value} scambi di review e commenti. Si capiscono con un’emoji.',
  },
  night_shift: {
    title: 'Premio alla carriera per il turno di notte',
    description: '{winner} ha firmato il commit più tardo dell’anno. Le stelle facevano il tifo.',
  },
  pipeline_phoenix: {
    title: 'Miglior resurrezione in una pipeline',
    description: '{winner}: {value} volte dal rosso al verde. Risorge più di un finale di serie.',
  },
  emoji_of_the_year: {
    title: 'Miglior emoji protagonista',
    description: 'L’emoji dell’anno è “{detail}”, usata {value} volte da {winner}. Un classico.',
  },
  marathon_mr: {
    title: 'Premio alla carriera per la MR più longeva',
    description: 'La MR di {winner} è aperta da {value} giorni. Un’opera ancora in lavorazione.',
  },
  hemingway: {
    title: 'Premio Hemingway per la sintesi',
    description:
      '{winner} ha scritto il commit più asciutto: “{detail}”. Poche parole, molto mistero.',
  },
  tolstoy: {
    title: 'Premio Tolstoj per la miglior narrativa',
    description: '{winner}: un commit da {value} caratteri. Guerra e pace, versione diff.',
  },
  golden_broom: {
    title: 'Miglior scopa d’oro',
    description: '{winner} ha tolto più righe di quante ne abbia messe. Il repo respira meglio.',
  },
  friday_courage: {
    title: 'Premio al coraggio del venerdì',
    description: '{winner}: {value} deploy di venerdì pomeriggio. Nervi saldi e weekend appeso.',
  },
  first_light: {
    title: 'Miglior fotografia alle prime luci',
    description:
      '{winner} ha firmato il primo commit dell’anno, con la rugiada ancora sul monitor.',
  },
};
