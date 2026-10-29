import type { CopyCatalog } from '@git-wrapped/contracts';

export const loading: CopyCatalog['loading'] = [
  'Sveglio i commit dal letargo…',
  'Conto le parentesi graffe una a una…',
  'Chiedo a git blame di restare gentile…',
  'Interrogo il reflog, ma con tatto…',
  'Faccio il rebase delle tue emozioni…',
  'Lucido i badge con un panno morbido…',
  'Consulto le stelle e la pipeline…',
  'Scarto i commit con la parola “fix” ripetuta…',
  'Cerco il tuo ultimo TODO risolto…',
  'Metto il caffè in cache…',
];

export const intro: CopyCatalog['intro'] = [
  'Ciao {name}! Ecco il tuo {year} in git, tra commit, review e qualche pipeline rossa.',
  'Il {year} è passato, i commit restano. Vediamo che anno è stato, {name}.',
  'Allacciati la cintura, {name}: il tuo {year} sta per andare in scena.',
  'Luci basse, popcorn in mano: il tuo {year} in git comincia adesso.',
];

export const outro: CopyCatalog['outro'] = [
  'Fine della storia, {name}. Ci vediamo nel prossimo commit!',
  'Questo è stato il tuo {year}. Il {year} che arriva ha già un branch aperto.',
  'Grazie per aver pushato con noi, {name}. Sipario, applausi e merge.',
  'Tutto qui. Il resto dell’anno è ancora da scrivere, un commit alla volta.',
];

export const ui: CopyCatalog['ui'] = {
  app_title: 'Git Wrapped',
  app_tagline: 'Il tuo anno di codice, raccontato con stile.',
  demo_mode_banner: 'Modalità demo: team e dati sono inventati. Nessun GitLab è stato disturbato.',
  pick_member: 'Chi sei nel team?',
  pick_member_hint: 'Scegli il tuo nome dalla lista per vedere il tuo anno.',
  start_story: 'Inizia la storia',
  loading_story: 'Preparo la tua storia…',
  download_png: 'Scarica la card in PNG',
  download_summary_png: 'Scarica il riepilogo in PNG',
  share_hint: 'Il PNG lo crea il tuo browser: condividi solo quello che scegli tu.',
  calendar_upload_title: 'Aggiungi il calendario (facoltativo)',
  calendar_upload_hint: 'Trascina qui un file .ics esportato da Outlook, oppure scegli dal disco.',
  calendar_privacy_note: 'Il file .ics resta nel tuo browser: non viene inviato a nessun server.',
  calendar_parsing: 'Leggo il calendario, qui sul tuo dispositivo…',
  calendar_error: 'Non riesco a leggere questo file. Controlla che sia un .ics valido.',
  calendar_skip: 'Salta, vado senza calendario',
  oscar_title: 'La notte degli Oscar del team',
  oscar_cta: 'Apri la cerimonia dei premi',
  error_generic: 'Qualcosa è andato storto. Un classico, per fortuna c’è un riprova.',
  error_not_found: 'Non trovo nessun dato per questo nome. Ricontrolla la lista.',
  retry: 'Riprova',
  pause: 'Pausa',
  resume: 'Riprendi',
  next: 'Avanti',
  previous: 'Indietro',
  close: 'Chiudi',
  restart: 'Ricomincia da capo',
};
