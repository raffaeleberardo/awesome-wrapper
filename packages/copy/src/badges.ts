import type { CopyCatalog } from '@git-wrapped/contracts';

export const badges: CopyCatalog['badges'] = {
  night_owl: {
    title: 'Gufo notturno',
    description: '{value} dei tuoi commit nasce a notte fonda. Il tuo IDE ha la luna come sfondo.',
  },
  early_bird: {
    title: 'Allodola',
    description: 'Commit all’alba, quando persino la CI dorme. Il caffè ti fa da co-autore.',
  },
  main_breaker: {
    title: 'Distruttore di main',
    description: '{value} pipeline rosse su main. Ha retto tutto, tranne la fiducia nei test.',
  },
  blind_approver: {
    title: 'Approvatore cieco',
    description: '{value} approvazioni lampo su MR enormi. Lettura veloce o fiducia cosmica?',
  },
  novelist: {
    title: 'Romanziere',
    description: 'Commit e commenti da capitolo di libro. Il prossimo Strega è un changelog.',
  },
  silent_monk: {
    title: 'Monaco silenzioso',
    description: 'Messaggi di una parola, descrizioni vuote. Il codice parla da sé, dicono.',
  },
  ghost_mr: {
    title: 'MR fantasma',
    description: '{value} MR si aggirano ancora per il repo, tra aperte e mai unite.',
  },
  lives_dangerously: {
    title: 'Vive pericolosamente',
    description: '{value} deploy di venerdì dopo le 16. Il weekend ringrazia per l’adrenalina.',
  },
  marie_kondo: {
    title: 'Marie Kondo',
    description: 'Cancelli più di quanto aggiungi. Ogni riga morta ha ricevuto un grazie.',
  },
  todo_collector: {
    title: 'Collezionista di TODO',
    description: 'I TODO nuovi superano quelli risolti. Un domani glorioso, sempre rimandato.',
  },
  necromancer: {
    title: 'Necromante',
    description: 'Hai riaperto issue sepolte da mesi. Qualcuno doveva pur risvegliare i morti.',
  },
  polyglot: {
    title: 'Poliglotta',
    description: '{value} linguaggi in un anno. Dialoghi coi compilatori in ogni dialetto.',
  },
  emoji_overlord: {
    title: 'Re delle reazioni',
    description: '{value} emoji regalate. Ogni MR del team ha avuto la sua dose di coriandoli.',
  },
};
