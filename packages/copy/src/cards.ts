import type { CopyCatalog } from '@git-wrapped/contracts';

export const cards: CopyCatalog['cards'] = {
  intro: { title: 'Il tuo {year} in git', subtitle: 'Ciao {name}, si accendono i commit.' },
  key_numbers: { title: 'I numeri chiave', subtitle: 'Un anno intero, ridotto a poche cifre.' },
  top_projects: { title: 'Casa dolce repo', subtitle: 'Dove hai passato più tempo nel {year}.' },
  top_files: { title: 'I file del cuore', subtitle: 'Quelli che hai aperto più spesso.' },
  languages: { title: 'Le tue lingue', subtitle: 'Quante ne parli, e quanto spesso.' },
  hours: { title: 'Il tuo orologio', subtitle: 'Quando il tuo codice prende vita.' },
  streak: { title: 'La serie d’oro', subtitle: '{value} giorni di fila con almeno un commit.' },
  duet: { title: 'Il tuo duetto', subtitle: 'La collega o il collega con cui scambi più review.' },
  emoji: { title: 'Pioggia di emoji', subtitle: 'Quelle date e quelle ricevute.' },
  commit_messages: {
    title: 'Poesia in commit',
    subtitle: 'Le parole che hai lasciato alla storia.',
  },
  pipeline_graveyard: {
    title: 'Il cimitero delle pipeline',
    subtitle: '{value} rosse, ognuna con la sua lapide.',
  },
  ghost_mrs: { title: 'MR fantasma', subtitle: '{value} anime in pena aspettano un merge.' },
  friday_deploys: {
    title: 'Venerdì di fuoco',
    subtitle: '{value} deploy nel pomeriggio del destino.',
  },
  calendar: { title: 'Il tuo calendario', subtitle: 'Tra riunioni e codice, il tuo {year}.' },
  badges: {
    title: 'I tuoi badge',
    subtitle: '{value} riconoscimenti, tutti conquistati sul campo.',
  },
  personality: {
    title: 'La tua personalità',
    subtitle: 'Il ritratto di {name} davanti al codice.',
  },
  horoscope: { title: 'Oroscopo {year}', subtitle: 'Le stelle hanno letto il tuo log.' },
  summary: { title: 'Il riepilogo', subtitle: 'Il tuo {year}, tutto in una card.' },
};
