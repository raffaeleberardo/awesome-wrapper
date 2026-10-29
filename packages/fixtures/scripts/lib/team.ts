import type {
  Member,
  RawActivity,
  RawApprovalGiven,
  RawCommit,
  RawDeployment,
  RawEmojiGiven,
  RawEmojiReceived,
  RawIssueEvent,
  RawMergeRequest,
  RawNote,
  RawPipeline,
  RawProject,
  RawPushEvent,
} from '@git-wrapped/contracts';
import { chance, hex, int, mulberry32, pick, weighted, type Rng } from './rng';
import { DAY, MINUTE, romeAt, romeWeekday, toIso } from './time';

/**
 * Generatore del team demo. Tutto è deterministico: stesso seed → stessi dati.
 * Persone, progetti e testi sono inventati (`@example.com`, `acme/...`).
 *
 * Ogni sviluppatore ha una personalità dominante e un profilo numerico che fa scattare
 * uno o più badge con margine (circa il doppio della soglia). Le soglie sono in
 * `packages/stats/BADGES.md` (A3) e replicate nei test di `packages/fixtures/src`.
 */

export const TEAM_YEAR = 2026;
const SEED = 20260101;

/** Primo e ultimo giorno con attività (fine anno lasciata libera per gli MR aperti). */
const FIRST_DAY = romeAt(TEAM_YEAR, 1, 5);
const LAST_ACTIVE_DAY = romeAt(TEAM_YEAR, 12, 18);
const YEAR_END = romeAt(TEAM_YEAR, 12, 31, 23, 59, 59);

/** Intervallo di minuti del giorno (0–1439). `to` può superare 1440: l'orario va in modulo. */
interface Window {
  weight: number;
  from: number;
  to: number;
}

interface ProjectSpec {
  id: number;
  path: string;
  languages: Record<string, number>;
  lastActivityBeforeYearAt: string;
  files: string[];
}

const RECENT = '2025-12-29T18:20:00+01:00';

const PROJECTS: ProjectSpec[] = [
  {
    id: 101,
    path: 'acme/piattaforma/backend',
    languages: { TypeScript: 82.5, Shell: 10.1, Dockerfile: 7.4 },
    lastActivityBeforeYearAt: RECENT,
    files: [
      'src/server.ts',
      'src/routes/orders.ts',
      'src/routes/users.ts',
      'src/services/pricing.ts',
      'src/services/inventory.ts',
      'src/db/queries.ts',
      'src/middleware/auth.ts',
      'src/lib/logger.ts',
      'test/orders.test.ts',
      'src/config.ts',
    ],
  },
  {
    id: 102,
    path: 'acme/piattaforma/frontend',
    languages: { TypeScript: 78.4, CSS: 14.2, HTML: 7.4 },
    lastActivityBeforeYearAt: '2025-12-28T11:02:00+01:00',
    files: [
      'src/pages/Cart.tsx',
      'src/components/Header.tsx',
      'src/hooks/useOrders.ts',
      'src/styles/theme.ts',
      'src/pages/Checkout.tsx',
      'src/components/OrderList.tsx',
    ],
  },
  {
    id: 103,
    path: 'acme/piattaforma/infra',
    languages: { Shell: 92.3, Dockerfile: 7.7 },
    lastActivityBeforeYearAt: '2025-12-30T09:45:00+01:00',
    files: ['scripts/deploy.sh', 'scripts/backup.sh', 'scripts/rotate-logs.sh'],
  },
  {
    id: 201,
    path: 'acme/dati/pipeline-etl',
    languages: { Python: 70.1, SQL: 24.9, Shell: 5 },
    lastActivityBeforeYearAt: '2025-12-22T16:30:00+01:00',
    files: [
      'etl/extract.py',
      'etl/transform.py',
      'etl/load.py',
      'etl/utils.py',
      'tests/test_load.py',
    ],
  },
  {
    id: 202,
    path: 'acme/dati/report-service',
    languages: { Go: 90.2, Shell: 9.8 },
    lastActivityBeforeYearAt: '2025-12-24T08:12:00+01:00',
    files: [
      'cmd/report/main.go',
      'internal/render/pdf.go',
      'internal/store/store.go',
      'internal/api/handlers.go',
    ],
  },
  {
    id: 203,
    path: 'acme/dati/warehouse-sql',
    languages: { SQL: 95, Shell: 5 },
    lastActivityBeforeYearAt: '2025-12-20T13:40:00+01:00',
    files: ['sql/views/ordini.sql', 'sql/views/clienti.sql', 'sql/migrations/0042_add_index.sql'],
  },
  {
    id: 301,
    path: 'acme/legacy/intranet-php',
    languages: { PHP: 88, JavaScript: 12 },
    lastActivityBeforeYearAt: '2024-03-19T16:45:00+01:00',
    files: [
      'app/Controllers/OrdiniController.php',
      'app/Models/Cliente.php',
      'config/database.php',
    ],
  },
  {
    id: 401,
    path: 'acme/mobile/app-cassa',
    languages: { TypeScript: 90, CSS: 10 },
    lastActivityBeforeYearAt: '2025-12-18T14:10:00+01:00',
    files: ['src/screens/Checkout.ts', 'src/screens/Cart.ts', 'src/printer/receipt.ts'],
  },
  {
    id: 501,
    path: 'acme/tools/cli-utils',
    languages: { TypeScript: 100 },
    lastActivityBeforeYearAt: '2025-12-26T10:00:00+01:00',
    files: ['src/index.ts', 'src/commands/sync.ts', 'src/commands/clean.ts'],
  },
];

const projectById = (id: number): ProjectSpec => {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) throw new Error(`progetto ${id} sconosciuto`);
  return project;
};

// ---------------------------------------------------------------- testi dei commit

const ARCHITECT_MESSAGES = [
  'feat(ordini): introduce regole di pricing componibili',
  'feat(servizi): sconto come strategia separata dal carrello',
  'feat(inventario): prenotazione con TTL e rilascio automatico',
  'refactor: estrae i tipi del dominio in un modulo condiviso',
  "chore(db): query preparate per l'inventario",
  'feat(api): endpoint di riepilogo per il checkout',
  'feat(auth): middleware componibile per i ruoli',
  'feat(logger): contesto di richiesta in ogni riga di log',
  'test(ordini): casi limite per il pricing a più righe',
  'fix(inventario): race condition sulla prenotazione concorrente',
];

const FIREFIGHTER_MESSAGES = [
  'hotfix: ripristina il deploy dopo il rollback',
  'fix: timeout sul webhook di pagamento',
  'fix: config mancante in produzione',
  'hotfix: rinnova il certificato scaduto',
  'fix(ci): riprova il job di migrazione',
  'chore: aggiorna l immagine base del runner',
  'fix: evita il 500 sugli ordini vuoti',
  'hotfix: sblocca la coda degli ordini bloccati',
  'chore(infra): backup notturno più frequente',
];

const GARDENER_MESSAGES = [
  'refactor: rimuove il vecchio client HTTP',
  'chore: elimina le feature flag scadute',
  'refactor(legacy): toglie il codice morto dai controller',
  'chore: pulizia dei file di log vecchi',
  'refactor: semplifica la gestione degli errori',
  'chore: rimuove dipendenze non più usate',
  'refactor(legacy): elimina la vecchia pagina di report',
  'chore(ui): toglie stili che nessuno usa più',
];

const DIPLOMAT_MESSAGES = [
  'fix: allinea la validazione alle richieste di review',
  'feat: aggiunge la conferma prima di svuotare il carrello',
  'refactor: accorcia Header come suggerito in review',
  'fix(ui): focus visibile sui campi del form',
  'test: copre il caso del carrello vuoto',
  'chore: aggiorna le regole di lint condivise',
];

const SPRINTER_MESSAGES = [
  'feat: filtro per data nel report',
  'wip: query della migrazione',
  'feat: valori null ammessi nel CSV',
  'feat: esporta anche il totale',
  'chore: colonna duplicata tolta dal load',
  'wip: test del parser',
  'fix: encoding del file di export',
  'feat: indice su cliente_id',
  'chore: log più chiari nel job',
  'fix: ordinamento righe del report',
];

const NIGHT_MESSAGES = [
  'wip notte: provo a mano il flusso del rimborso',
  'fix notturno: il job non rilegge il cursore',
  'wip: idea per il caching della lista ordini',
  'fix: fuso orario sbagliato dopo mezzanotte',
  'feat: prototipo della ricerca veloce',
  'wip: sistemo i test che falliscono alle 3 di notte',
];

const METRONOME_MESSAGES = [
  'ok',
  'fix',
  'wip',
  'upd',
  'boh',
  'typo',
  'ok!',
  'x',
  'fix typo',
  '...',
  'ok ok',
  'upd lint',
];

const PHILOSOPHER_SENTENCES = [
  'Ho riletto la logica del carrello e il totale viene ricalcolato due volte, una nel client e una nel server.',
  'Quando lo sconto si applica su più righe le due cifre a volte differiscono di qualche centesimo, e va sistemato.',
  'Ho provato a estrarre una funzione pura, ma poi i test sugli arrotondamenti hanno iniziato a fallire uno dopo l altro.',
  'Forse la vera domanda è chi possiede il prezzo finale: il carrello, il listino o il cliente che lo sta guardando.',
  'Ho lasciato un TODO per ricordarmi di discuterne con Giulia prima del prossimo rilascio, senza fretta.',
  "Nel frattempo ho sistemato anche l'arrotondamento dell'IVA, un'altra cosa che mi dava pensieri da settimane.",
  'Non è una correzione definitiva, è un passo verso una versione in cui il calcolo sta in un solo posto e si testa da solo.',
  'Ringrazio chi ha fatto la review con pazienza, perché le osservazioni sui casi limite hanno cambiato più di una riga.',
  'Scrivo queste righe anche per me, tra qualche mese vorrò ricordare perché abbiamo scelto questa strada e non un altra.',
];

function philosopherMessage(r: Rng): string {
  const count = int(r, 2, 3);
  const chosen = new Set<string>();
  while (chosen.size < count) chosen.add(pick(r, PHILOSOPHER_SENTENCES));
  return [...chosen].join(' ');
}

// ---------------------------------------------------------------- profili

interface Persona {
  username: string;
  displayName: string;
  /** Totali annui. */
  commits: number;
  mergeRequests: number;
  /** Probabilità che un giorno feriale / weekend sia attivo. */
  activeDay: number;
  weekendDay: number;
  /** Orari dei commit, in minuti del giorno. */
  windows: Window[];
  /** Commit a raffica nello stesso giorno, distanziati di qualche minuto. */
  burst: boolean;
  mainShare: number;
  projects: { id: number; weight: number }[];
  files: [number, number];
  additions: [number, number];
  deletions: [number, number];
  todoAddChance: number;
  todoRemoveChance: number;
  message: (r: Rng) => string;
  topics: string[];
  /** Righe cambiate per MR. */
  mrChangedLines: (r: Rng) => number;
  mrDescriptionLength: (r: Rng) => number;
  /** Ritardo tra creazione MR e approvazione, in minuti (mai sotto 30 se non è un'approvazione cieca). */
  approvalDelay: [number, number];
  /** Note scritte sulle MR dei colleghi. */
  notes: { chance: number; length: [number, number] };
  emojiGiven: number;
  issues: { opened: [number, number]; closed: [number, number] };
  pipelineChance: number;
  /** Pipeline fallite sul branch di default (sempre scelte tra quelle sul default). */
  mainFailures: number;
  /** Deploy feriali (lunedì–giovedì). */
  weekdayDeploys: { count: number; from: number; to: number; environments: string[] };
  /** Deploy del venerdì pomeriggio (dalle 16:00). */
  fridayDeploys: number;
  /** Push che cancellano un branch. */
  deletedBranchPushes: number;
  /** MR chiuse senza merge. */
  closedMergeRequests: number;
  /** MR aperte e ferme a fine anno (non stantie). */
  openMergeRequests: number;
  /** Issue riaperte dopo più di 180 giorni (il Necromante). */
  reopenedIssues: ReopenedIssue[];
  /** Commit su un progetto con attività molto vecchia. */
  legacyCommits?: { projectId: number; count: number; from: number; to: number };
}

interface ReopenedIssue {
  at: string;
  issueCreatedAt: string;
  previouslyClosedAt: string;
  projectId: number;
  issueIid: number;
}

const PERSONAS: Persona[] = [
  {
    username: 'giulia.ferri',
    displayName: 'Giulia Ferri',
    commits: 420,
    mergeRequests: 36,
    activeDay: 0.55,
    weekendDay: 0.03,
    windows: [
      { weight: 0.5, from: 9 * 60, to: 13 * 60 },
      { weight: 0.5, from: 14 * 60, to: 19 * 60 },
    ],
    burst: false,
    mainShare: 0.2,
    projects: [
      { id: 101, weight: 0.6 },
      { id: 102, weight: 0.4 },
    ],
    files: [8, 16],
    additions: [120, 520],
    deletions: [40, 180],
    todoAddChance: 0.08,
    todoRemoveChance: 0.02,
    message: (r) => pick(r, ARCHITECT_MESSAGES),
    topics: ['pricing', 'ordini', 'inventario', 'auth', 'checkout'],
    mrChangedLines: (r) => (chance(r, 0.7) ? int(r, 500, 1500) : int(r, 100, 300)),
    mrDescriptionLength: (r) => int(r, 120, 420),
    approvalDelay: [30, 36 * 60],
    notes: { chance: 0.25, length: [15, 120] },
    emojiGiven: 30,
    issues: { opened: [6, 12], closed: [4, 9] },
    pipelineChance: 0.7,
    mainFailures: 0,
    weekdayDeploys: {
      count: 12,
      from: 10 * 60,
      to: 12 * 60,
      environments: ['staging', 'production'],
    },
    fridayDeploys: 0,
    deletedBranchPushes: 0,
    closedMergeRequests: 0,
    openMergeRequests: 1,
    reopenedIssues: [],
  },
  {
    username: 'marco.vitale',
    displayName: 'Marco Vitale',
    commits: 380,
    mergeRequests: 56,
    activeDay: 0.6,
    weekendDay: 0.12,
    windows: [
      { weight: 0.85, from: 9 * 60, to: 18 * 60 + 30 },
      { weight: 0.12, from: 19 * 60, to: 21 * 60 + 30 },
      { weight: 0.03, from: 22 * 60, to: 22 * 60 + 59 },
    ],
    burst: false,
    mainShare: 0.45,
    projects: [
      { id: 103, weight: 0.25 },
      { id: 101, weight: 0.75 },
    ],
    files: [1, 3],
    additions: [8, 70],
    deletions: [4, 45],
    todoAddChance: 0,
    todoRemoveChance: 0,
    message: (r) => pick(r, FIREFIGHTER_MESSAGES),
    topics: ['hotfix', 'webhook', 'rollback', 'certificati', 'runner'],
    mrChangedLines: (r) => int(r, 4, 90),
    mrDescriptionLength: (r) => (chance(r, 0.3) ? int(r, 20, 120) : 0),
    approvalDelay: [30, 180],
    notes: { chance: 0.2, length: [20, 110] },
    emojiGiven: 22,
    issues: { opened: [4, 8], closed: [4, 8] },
    pipelineChance: 0.7,
    mainFailures: 14,
    weekdayDeploys: {
      count: 14,
      from: 10 * 60,
      to: 11 * 60 + 30,
      environments: ['staging', 'production'],
    },
    fridayDeploys: 7,
    deletedBranchPushes: 0,
    closedMergeRequests: 0,
    openMergeRequests: 0,
    reopenedIssues: [],
  },
  {
    username: 'chiara.esposito',
    displayName: 'Chiara Esposito',
    commits: 260,
    mergeRequests: 40,
    activeDay: 0.55,
    weekendDay: 0.02,
    windows: [{ weight: 1, from: 9 * 60, to: 17 * 60 + 30 }],
    burst: false,
    mainShare: 0.3,
    projects: [
      { id: 301, weight: 0.2 },
      { id: 401, weight: 0.5 },
      { id: 501, weight: 0.3 },
    ],
    files: [2, 5],
    additions: [15, 60],
    deletions: [50, 170],
    todoAddChance: 0,
    todoRemoveChance: 0.25,
    message: (r) => pick(r, GARDENER_MESSAGES),
    topics: ['cleanup', 'legacy', 'flag', 'log', 'dipendenze'],
    mrChangedLines: (r) => int(r, 60, 420),
    mrDescriptionLength: (r) => int(r, 40, 300),
    approvalDelay: [30, 36 * 60],
    notes: { chance: 0.25, length: [20, 130] },
    emojiGiven: 25,
    issues: { opened: [5, 10], closed: [5, 9] },
    pipelineChance: 0.7,
    mainFailures: 0,
    weekdayDeploys: { count: 9, from: 10 * 60, to: 11 * 60 + 30, environments: ['production'] },
    fridayDeploys: 0,
    deletedBranchPushes: 30,
    closedMergeRequests: 0,
    openMergeRequests: 0,
    reopenedIssues: [
      {
        at: toIso(romeAt(TEAM_YEAR, 2, 17, 10, 20)),
        issueCreatedAt: '2024-06-03T09:12:00+02:00',
        previouslyClosedAt: '2025-01-14T16:40:00+01:00',
        projectId: 301,
        issueIid: 214,
      },
      {
        at: toIso(romeAt(TEAM_YEAR, 7, 6, 11, 5)),
        issueCreatedAt: '2024-05-20T14:30:00+02:00',
        previouslyClosedAt: '2025-03-02T15:00:00+01:00',
        projectId: 301,
        issueIid: 231,
      },
      {
        at: toIso(romeAt(TEAM_YEAR, 10, 12, 9, 30)),
        issueCreatedAt: '2024-04-11T10:02:00+02:00',
        previouslyClosedAt: '2025-05-27T10:10:00+02:00',
        projectId: 301,
        issueIid: 247,
      },
    ],
    legacyCommits: {
      projectId: 301,
      count: 52,
      from: romeAt(TEAM_YEAR, 2, 2),
      to: romeAt(TEAM_YEAR, 11, 20),
    },
  },
  {
    username: 'luca.moretti',
    displayName: 'Luca Moretti',
    commits: 180,
    mergeRequests: 24,
    activeDay: 0.55,
    weekendDay: 0.01,
    windows: [
      { weight: 0.7, from: 9 * 60, to: 13 * 60 },
      { weight: 0.3, from: 14 * 60, to: 18 * 60 },
    ],
    burst: false,
    mainShare: 0.1,
    projects: [
      { id: 101, weight: 0.5 },
      { id: 102, weight: 0.5 },
    ],
    files: [2, 4],
    additions: [30, 110],
    deletions: [15, 60],
    todoAddChance: 0.01,
    todoRemoveChance: 0,
    message: (r) => pick(r, DIPLOMAT_MESSAGES),
    topics: ['validazione', 'carrello', 'form', 'lint', 'test'],
    mrChangedLines: (r) => int(r, 40, 260),
    mrDescriptionLength: (r) => int(r, 80, 400),
    approvalDelay: [30, 36 * 60],
    notes: { chance: 0.85, length: [40, 160] },
    emojiGiven: 320,
    issues: { opened: [4, 8], closed: [3, 7] },
    pipelineChance: 0.6,
    mainFailures: 0,
    weekdayDeploys: { count: 6, from: 10 * 60, to: 11 * 60 + 30, environments: ['staging'] },
    fridayDeploys: 0,
    deletedBranchPushes: 0,
    closedMergeRequests: 0,
    openMergeRequests: 0,
    reopenedIssues: [],
  },
  {
    username: 'sara.bianchi',
    displayName: 'Sara Bianchi',
    commits: 640,
    mergeRequests: 70,
    activeDay: 0.8,
    weekendDay: 0.02,
    windows: [{ weight: 1, from: 9 * 60, to: 18 * 60 }],
    burst: true,
    mainShare: 0.1,
    projects: [
      { id: 201, weight: 0.22 },
      { id: 202, weight: 0.2 },
      { id: 203, weight: 0.2 },
      { id: 103, weight: 0.14 },
      { id: 501, weight: 0.24 },
    ],
    files: [1, 2],
    additions: [4, 40],
    deletions: [2, 28],
    todoAddChance: 0,
    todoRemoveChance: 0,
    message: (r) => pick(r, SPRINTER_MESSAGES),
    topics: ['report', 'etl', 'csv', 'migrazione', 'export'],
    mrChangedLines: (r) => int(r, 3, 70),
    mrDescriptionLength: (r) => (chance(r, 0.2) ? int(r, 10, 80) : 0),
    approvalDelay: [30, 240],
    notes: { chance: 0.2, length: [15, 90] },
    emojiGiven: 18,
    issues: { opened: [8, 12], closed: [6, 10] },
    pipelineChance: 0.7,
    mainFailures: 0,
    weekdayDeploys: { count: 8, from: 10 * 60, to: 12 * 60, environments: ['staging'] },
    fridayDeploys: 0,
    deletedBranchPushes: 0,
    closedMergeRequests: 6,
    openMergeRequests: 0,
    reopenedIssues: [],
  },
  {
    username: 'davide.rinaldi',
    displayName: 'Davide Rinaldi',
    commits: 210,
    mergeRequests: 22,
    activeDay: 0.55,
    weekendDay: 0.02,
    windows: [
      { weight: 0.75, from: 10 * 60, to: 13 * 60 },
      { weight: 0.25, from: 14 * 60, to: 18 * 60 },
    ],
    burst: false,
    mainShare: 0.2,
    projects: [
      { id: 101, weight: 0.5 },
      { id: 102, weight: 0.5 },
    ],
    files: [2, 5],
    additions: [40, 150],
    deletions: [20, 70],
    todoAddChance: 0,
    todoRemoveChance: 0,
    message: philosopherMessage,
    topics: ['carrello', 'sconti', 'iva', 'arrotondamenti', 'checkout'],
    mrChangedLines: (r) => int(r, 120, 520),
    mrDescriptionLength: (r) => int(r, 500, 1200),
    approvalDelay: [30, 36 * 60],
    notes: { chance: 0.9, length: [450, 950] },
    emojiGiven: 38,
    issues: { opened: [4, 8], closed: [3, 6] },
    pipelineChance: 0.6,
    mainFailures: 0,
    weekdayDeploys: { count: 5, from: 10 * 60, to: 12 * 60, environments: ['staging'] },
    fridayDeploys: 0,
    deletedBranchPushes: 0,
    closedMergeRequests: 0,
    openMergeRequests: 0,
    reopenedIssues: [],
  },
  {
    username: 'elena.costa',
    displayName: 'Elena Costa',
    commits: 340,
    mergeRequests: 30,
    activeDay: 0.6,
    weekendDay: 0.6,
    windows: [
      { weight: 0.62, from: 22 * 60, to: 29 * 60 },
      { weight: 0.2, from: 0, to: 5 * 60 },
      { weight: 0.18, from: 9 * 60, to: 17 * 60 },
    ],
    burst: false,
    mainShare: 0.2,
    projects: [
      { id: 101, weight: 0.4 },
      { id: 102, weight: 0.6 },
    ],
    files: [1, 3],
    additions: [20, 100],
    deletions: [10, 60],
    todoAddChance: 0,
    todoRemoveChance: 0,
    message: (r) => pick(r, NIGHT_MESSAGES),
    topics: ['notturno', 'cache', 'ricerca', 'timezone', 'rimborsi'],
    mrChangedLines: (r) => int(r, 20, 180),
    mrDescriptionLength: (r) => (chance(r, 0.5) ? 0 : int(r, 20, 200)),
    approvalDelay: [30, 36 * 60],
    notes: { chance: 0.25, length: [15, 60] },
    emojiGiven: 26,
    issues: { opened: [4, 8], closed: [3, 7] },
    pipelineChance: 0.7,
    mainFailures: 0,
    weekdayDeploys: { count: 4, from: 23 * 60, to: 23 * 60 + 45, environments: ['production'] },
    fridayDeploys: 0,
    deletedBranchPushes: 0,
    closedMergeRequests: 0,
    openMergeRequests: 1,
    reopenedIssues: [],
  },
  {
    username: 'andrea.galli',
    displayName: 'Andrea Galli',
    commits: 300,
    mergeRequests: 34,
    activeDay: 0.85,
    weekendDay: 0,
    windows: [{ weight: 1, from: 6 * 60 + 30, to: 7 * 60 + 45 }],
    burst: false,
    mainShare: 0.5,
    projects: [
      { id: 101, weight: 0.45 },
      { id: 501, weight: 0.55 },
    ],
    files: [1, 2],
    additions: [2, 25],
    deletions: [2, 18],
    todoAddChance: 0,
    todoRemoveChance: 0,
    message: (r) => pick(r, METRONOME_MESSAGES),
    topics: ['cli', 'sync', 'pulizia', 'typo', 'lint'],
    mrChangedLines: (r) => int(r, 2, 40),
    mrDescriptionLength: () => 0,
    approvalDelay: [30, 240],
    notes: { chance: 0, length: [0, 0] },
    emojiGiven: 6,
    issues: { opened: [3, 6], closed: [2, 5] },
    pipelineChance: 0.7,
    mainFailures: 0,
    weekdayDeploys: { count: 10, from: 7 * 60, to: 8 * 60 + 15, environments: ['staging'] },
    fridayDeploys: 0,
    deletedBranchPushes: 0,
    closedMergeRequests: 0,
    openMergeRequests: 0,
    reopenedIssues: [],
  },
];

export const TEAM_USERNAMES = PERSONAS.map((p) => p.username);
const LUCA = 'luca.moretti';

/** Persone nel team, nell'ordine in cui compaiono nella lista. */
export const TEAM_MEMBERS: Member[] = PERSONAS.map((p) => ({
  username: p.username,
  displayName: p.displayName,
}));

// ---------------------------------------------------------------- utilità temporali

const timed = <T>(at: number, value: T) => ({ at, value });
type Timed<T> = { at: number; value: T };

function sampleMinute(r: Rng, windows: Window[]): number {
  const window = weighted(
    r,
    windows.map((w) => ({ value: w, weight: w.weight })),
  );
  return int(r, window.from, window.to - 1) % 1440;
}

/** Giorni attivi di una persona nell'anno (inizio giornata locale). */
function activeDays(r: Rng, p: Persona): number[] {
  const days: number[] = [];
  for (let ms = FIRST_DAY; ms <= LAST_ACTIVE_DAY; ms += DAY) {
    const prob = romeWeekday(ms) >= 5 ? p.weekendDay : p.activeDay;
    if (chance(r, prob)) days.push(ms);
  }
  return days;
}

/** Distribuisce `total` istanti sui giorni attivi, con l'orario del profilo. */
function instants(r: Rng, p: Persona, days: number[], total: number): number[] {
  const perDay = new Map<number, number>();
  for (let i = 0; i < total; i++) {
    const day = pick(r, days);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const out: number[] = [];
  for (const [day, count] of perDay) {
    if (p.burst) {
      let at = day + sampleMinute(r, p.windows) * MINUTE;
      for (let k = 0; k < count; k++) {
        out.push(at);
        at += int(r, 15, 55) * MINUTE;
      }
    } else {
      const times = Array.from({ length: count }, () => day + sampleMinute(r, p.windows) * MINUTE);
      times.sort((a, b) => a - b);
      out.push(...times);
    }
  }
  return out.sort((a, b) => a - b);
}

function withinYear(ms: number): number {
  return Math.min(ms, YEAR_END);
}

function pickMany<T>(r: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const index = int(r, 0, pool.length - 1);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) out.push(item);
  }
  return out;
}

function weightedProject(r: Rng, p: Persona): number {
  return weighted(
    r,
    p.projects.map((x) => ({ value: x.id, weight: x.weight })),
  );
}

// ---------------------------------------------------------------- bozze

interface CommitDraft {
  at: number;
  onMain: boolean;
  ref: string;
  raw: RawCommit;
}

interface PipelineDraft {
  at: number;
  onMain: boolean;
  raw: RawPipeline;
}

interface MrDraft {
  author: string;
  project: ProjectSpec;
  createdAt: number;
  updatedAt: number;
  mergedAt: number | null;
  closedAt: number | null;
  state: RawMergeRequest['state'];
  changedLines: number;
  descriptionLength: number;
  reviewers: string[];
  approvals: { user: string; at: number }[];
  topic: string;
  iid: number;
  approvalDelay: [number, number];
}

interface NoteDraft {
  writer: string;
  mr: MrDraft;
  at: number;
  bodyLength: number;
}

interface EmojiDraft {
  giver: string;
  mr: MrDraft;
  at: number;
  name: string;
}

interface PersonaDraft {
  persona: Persona;
  commits: Timed<CommitDraft>[];
  pipelines: Timed<PipelineDraft>[];
  deployments: Timed<RawDeployment>[];
  pushes: Timed<RawPushEvent>[];
  issues: Timed<RawIssueEvent>[];
  mrs: MrDraft[];
}

const EMOJI_NAMES: { value: string; weight: number }[] = [
  { value: 'thumbsup', weight: 25 },
  { value: 'tada', weight: 10 },
  { value: 'rocket', weight: 8 },
  { value: 'white_check_mark', weight: 8 },
  { value: 'clap', weight: 8 },
  { value: 'fire', weight: 6 },
  { value: 'eyes', weight: 6 },
  { value: 'joy', weight: 5 },
  { value: 'pray', weight: 5 },
  { value: 'sparkles', weight: 5 },
  { value: 'raised_hands', weight: 4 },
  { value: 'heart', weight: 4 },
  { value: 'muscle', weight: 3 },
  { value: 'ok_hand', weight: 3 },
];

/** Coppie che si rivedono più spesso (il "duetto" ha senso). */
const PAIR_BOOST: [string, string, number][] = [
  ['giulia.ferri', 'davide.rinaldi', 3],
  ['marco.vitale', 'elena.costa', 2],
  ['sara.bianchi', 'andrea.galli', 2],
  ['chiara.esposito', 'giulia.ferri', 2],
];

function pairBoost(a: string, b: string): number {
  for (const [x, y, w] of PAIR_BOOST) {
    if ((a === x && b === y) || (a === y && b === x)) return w;
  }
  return 0;
}

// ---------------------------------------------------------------- costruzione

export interface TeamData {
  members: Member[];
  activities: Record<string, RawActivity>;
}

export function buildTeam(): TeamData {
  const usedShas = new Set<string>();
  const newSha = (r: Rng): string => {
    let sha = hex(r, 12);
    while (usedShas.has(sha)) sha = hex(r, 12);
    usedShas.add(sha);
    return sha;
  };

  let pipelineId = 41_000;
  const gr = mulberry32(SEED); // RNG globale: revisori, approvazioni, note, emoji

  // 1. Per ogni persona: commit, pipeline, push, deploy, issue e MR (con i dati propri).
  const drafts: PersonaDraft[] = PERSONAS.map((p, index) => {
    const r = mulberry32(SEED + (index + 1) * 7919);
    const days = activeDays(r, p);
    const times = instants(r, p, days, p.commits);

    const commits: Timed<CommitDraft>[] = times.map((at) => {
      const projectId = weightedProject(r, p);
      const project = projectById(projectId);
      const onMain = chance(r, p.mainShare);
      const ref = onMain ? 'main' : `feature/${pick(r, p.topics)}-${int(r, 1, 40)}`;
      const fileCount = int(r, p.files[0], p.files[1]);
      const files = pickMany(r, project.files, fileCount);
      const raw: RawCommit = {
        sha: newSha(r),
        authoredAt: toIso(at),
        projectPath: project.path,
        files,
        additions: int(r, p.additions[0], p.additions[1]),
        deletions: int(r, p.deletions[0], p.deletions[1]),
        message: p.message(r),
        isMerge: false,
        todosAdded: chance(r, p.todoAddChance) ? 1 : 0,
        todosRemoved: chance(r, p.todoRemoveChance) ? 1 : 0,
      };
      return timed(at, { at, onMain, ref, raw });
    });

    // Commit sui progetti legacy (necromante): aggiunti in fondo alla timeline del 2026.
    if (p.legacyCommits) {
      const legacy = p.legacyCommits;
      const legacyProject = projectById(legacy.projectId);
      for (let i = 0; i < legacy.count; i++) {
        const at =
          legacy.from +
          int(r, 0, Math.floor((legacy.to - legacy.from) / DAY)) * DAY +
          int(r, 9 * 60, 17 * 60) * MINUTE;
        commits.push(
          timed(at, {
            at,
            onMain: false,
            ref: `feature/legacy-${int(r, 1, 9)}`,
            raw: {
              sha: newSha(r),
              authoredAt: toIso(at),
              projectPath: legacyProject.path,
              files: pickMany(r, legacyProject.files, int(r, 1, 3)),
              additions: int(r, 10, 40),
              deletions: int(r, 30, 90),
              message: pick(r, GARDENER_MESSAGES),
              isMerge: false,
              todosAdded: 0,
              todosRemoved: chance(r, 0.4) ? 1 : 0,
            },
          }),
        );
      }
      commits.sort((a, b) => a.at - b.at);
    }

    // Pipeline: una ogni tanti commit. Sul default branch, Marco ne ha 14 fallite (scelte più avanti).
    const pipelines: Timed<PipelineDraft>[] = [];
    for (const c of commits) {
      if (!chance(r, p.pipelineChance)) continue;
      pipelineId += int(r, 1, 7);
      const at = c.at + int(r, 2, 9) * MINUTE;
      pipelines.push(
        timed(at, {
          at,
          onMain: c.value.onMain,
          raw: {
            id: pipelineId,
            projectPath: c.value.raw.projectPath,
            status: 'success',
            ref: c.value.ref,
            isDefaultBranch: c.value.onMain,
            createdAt: toIso(at),
            durationSeconds: int(r, 90, 900),
            author: p.username,
          },
        }),
      );
    }
    // Pipeline fallite sul default branch (solo per le persone con `mainFailures`).
    const mainPipelines = pipelines.filter((x) => x.value.onMain);
    for (const failing of pickMany(r, mainPipelines, p.mainFailures)) {
      failing.value.raw.status = 'failed';
    }
    // Pipeline fallite/annullate fuori dal default branch.
    for (const x of pipelines) {
      if (x.value.onMain) continue;
      const roll = r();
      if (roll < 0.11) x.value.raw.status = 'failed';
      else if (roll < 0.14) x.value.raw.status = 'canceled';
    }

    // Push: la maggior parte dei commit genera un evento `pushed`.
    const pushes: Timed<RawPushEvent>[] = [];
    for (const c of commits) {
      if (!chance(r, 0.6)) continue;
      const at = c.at + MINUTE;
      pushes.push(
        timed(at, {
          at: toIso(at),
          projectPath: c.value.raw.projectPath,
          action: 'pushed',
          refType: 'branch',
          ref: c.value.ref,
          isDefaultBranch: c.value.onMain,
          commitCount: 1,
        }),
      );
    }
    for (let i = 0; i < p.deletedBranchPushes; i++) {
      const at = pick(r, days) + sampleMinute(r, p.windows) * MINUTE;
      const project = projectById(weightedProject(r, p));
      pushes.push(
        timed(at, {
          at: toIso(at),
          projectPath: project.path,
          action: 'deleted',
          refType: 'branch',
          ref: `feature/${pick(r, p.topics)}-${int(r, 1, 60)}`,
          isDefaultBranch: false,
          commitCount: 0,
        }),
      );
    }

    // Deploy feriali e del venerdì pomeriggio.
    const deployments: Timed<RawDeployment>[] = [];
    const weekdays = days.filter((ms) => romeWeekday(ms) < 4);
    for (let i = 0; i < p.weekdayDeploys.count; i++) {
      const at =
        pick(r, weekdays) + int(r, p.weekdayDeploys.from, p.weekdayDeploys.to - 1) * MINUTE;
      deployments.push(
        timed(at, {
          projectPath: projectById(weightedProject(r, p)).path,
          environment: pick(r, p.weekdayDeploys.environments),
          status: chance(r, 0.08) ? 'failed' : 'success',
          createdAt: toIso(at),
        }),
      );
    }
    const fridays: number[] = [];
    for (let ms = FIRST_DAY; ms <= LAST_ACTIVE_DAY; ms += DAY) {
      if (romeWeekday(ms) === 4) fridays.push(ms);
    }
    for (const day of pickMany(r, fridays, p.fridayDeploys)) {
      const at = day + int(r, 16 * 60, 18 * 60 + 45) * MINUTE;
      deployments.push(
        timed(at, {
          projectPath: projectById(101).path,
          environment: 'production',
          status: chance(r, 0.15) ? 'failed' : 'success',
          createdAt: toIso(at),
        }),
      );
    }

    // Issue: aperte e chiuse nel corso dell'anno, più le riaperture del necromante.
    const issues: Timed<RawIssueEvent>[] = [];
    let issueIid = 100 + index * 37;
    const issueEvent = (
      action: RawIssueEvent['action'],
      at: number,
      createdAt: number,
      previouslyClosedAt: string | null,
      projectId: number,
    ) => {
      issueIid += int(r, 1, 9);
      issues.push(
        timed(at, {
          action,
          at: toIso(at),
          projectPath: projectById(projectId).path,
          issueIid,
          issueCreatedAt: toIso(createdAt),
          previouslyClosedAt,
        }),
      );
    };
    const openCount = int(r, p.issues.opened[0], p.issues.opened[1]);
    for (let i = 0; i < openCount; i++) {
      const at = pick(r, days) + sampleMinute(r, p.windows) * MINUTE;
      issueEvent('opened', at, at, null, weightedProject(r, p));
    }
    const closedCount = int(r, p.issues.closed[0], p.issues.closed[1]);
    for (let i = 0; i < closedCount; i++) {
      const at = pick(r, days) + sampleMinute(r, p.windows) * MINUTE;
      issueEvent('closed', at, at - int(r, 2, 60) * DAY, null, weightedProject(r, p));
    }
    for (const reopened of p.reopenedIssues) {
      issues.push(
        timed(Date.parse(reopened.at), {
          action: 'reopened',
          at: reopened.at,
          projectPath: projectById(reopened.projectId).path,
          issueIid: reopened.issueIid,
          issueCreatedAt: reopened.issueCreatedAt,
          previouslyClosedAt: reopened.previouslyClosedAt,
        }),
      );
    }

    // Merge request dell'autore.
    const mrs: MrDraft[] = [];
    for (let i = 0; i < p.mergeRequests; i++) {
      const project = projectById(weightedProject(r, p));
      const isClosed = i < p.closedMergeRequests;
      const isOpen = i >= p.mergeRequests - p.openMergeRequests;
      const createdAt = isOpen
        ? romeAt(TEAM_YEAR, 12, int(r, 10, 14), 11, 0)
        : pick(r, days) + sampleMinute(r, p.windows) * MINUTE;
      mrs.push({
        author: p.username,
        project,
        createdAt,
        updatedAt: createdAt,
        mergedAt: null,
        closedAt: null,
        state: isOpen ? 'opened' : isClosed ? 'closed' : 'merged',
        changedLines: p.mrChangedLines(r),
        descriptionLength: p.mrDescriptionLength(r),
        reviewers: [],
        approvals: [],
        topic: pick(r, p.topics),
        iid: 0,
        approvalDelay: p.approvalDelay,
      });
    }

    return { persona: p, commits, pipelines, deployments, pushes, issues, mrs };
  });

  // 2. MR globali: revisori, approvazioni, date di merge/chiusura, approvazioni cieche di Luca.
  const allMrs = drafts.flatMap((d) => d.mrs);
  for (const mr of allMrs) {
    const persona = PERSONAS.find((p) => p.username === mr.author);
    if (!persona) throw new Error('autore MR sconosciuto');

    // Revisori: Luca rivede spesso, poi una o due persone pesate sulle affinità.
    const reviewers: string[] = [];
    if (mr.author !== LUCA && chance(gr, 0.55)) reviewers.push(LUCA);
    const extra = chance(gr, 0.3) ? 2 : 1;
    const candidates = TEAM_USERNAMES.filter((u) => u !== mr.author && u !== LUCA);
    while (reviewers.length < extra + (reviewers.includes(LUCA) ? 1 : 0)) {
      const next = weighted(
        gr,
        candidates
          .filter((u) => !reviewers.includes(u))
          .map((u) => ({ value: u, weight: 1 + pairBoost(mr.author, u) })),
      );
      reviewers.push(next);
    }
    mr.reviewers = reviewers;

    if (mr.state === 'opened' || mr.state === 'closed') {
      if (mr.state === 'closed') {
        mr.closedAt = mr.createdAt + int(gr, 1, 4) * DAY;
        mr.updatedAt = mr.closedAt;
      } else {
        mr.updatedAt = romeAt(TEAM_YEAR, 12, 15, 10, 0);
      }
      continue;
    }

    // Approvazioni normali.
    const approvals: { user: string; at: number }[] = [];
    for (const reviewer of reviewers) {
      const approves = chance(gr, reviewer === LUCA ? 0.95 : 0.85);
      if (!approves) continue;
      approvals.push({
        user: reviewer,
        at: mr.createdAt + int(gr, mr.approvalDelay[0], mr.approvalDelay[1]) * MINUTE,
      });
    }
    if (approvals.length === 0 && reviewers[0]) {
      approvals.push({
        user: reviewers[0],
        at: mr.createdAt + int(gr, mr.approvalDelay[0], mr.approvalDelay[1]) * MINUTE,
      });
    }
    mr.approvals = approvals;
  }

  // Approvazioni cieche di Luca: 8 MR di Giulia con almeno 300 righe, approvate in 2–4 minuti.
  const giuliaBig = allMrs.filter(
    (mr) => mr.author === 'giulia.ferri' && mr.state === 'merged' && mr.changedLines >= 300,
  );
  for (const mr of pickMany(gr, giuliaBig, 8)) {
    if (!mr.reviewers.includes(LUCA)) mr.reviewers.push(LUCA);
    mr.approvals = mr.approvals.filter((a) => a.user !== LUCA);
    mr.approvals.push({ user: LUCA, at: mr.createdAt + int(gr, 2, 4) * MINUTE });
  }

  // Date di merge e aggiornamento per le MR unite.
  for (const mr of allMrs) {
    if (mr.state !== 'merged') continue;
    const lastApproval = Math.max(mr.createdAt, ...mr.approvals.map((a) => a.at));
    mr.mergedAt = withinYear(lastApproval + int(gr, 10, 120) * MINUTE);
    mr.updatedAt = mr.mergedAt;
  }

  // Numeri IID per progetto, in ordine di creazione.
  const iidCounter = new Map<string, number>();
  for (const mr of [...allMrs].sort((a, b) => a.createdAt - b.createdAt)) {
    const next = (iidCounter.get(mr.project.path) ?? 0) + 1;
    iidCounter.set(mr.project.path, next);
    mr.iid = next;
  }

  // Note sulle MR: le scrive chi revisiona, all'autore della MR (counterpart).
  const notes: NoteDraft[] = [];
  for (const mr of allMrs) {
    for (const reviewer of mr.reviewers) {
      const writer = PERSONAS.find((p) => p.username === reviewer);
      if (!writer || !chance(gr, writer.notes.chance)) continue;
      const at = withinYear(mr.createdAt + int(gr, 1, 20) * 60 * MINUTE);
      notes.push({
        writer: reviewer,
        mr,
        at,
        bodyLength: int(gr, writer.notes.length[0], writer.notes.length[1]),
      });
    }
  }

  // Emoji: Luca ne dà molte, le altre persone poche, sempre su MR altrui.
  const emojis: EmojiDraft[] = [];
  for (const persona of PERSONAS) {
    const others = allMrs.filter((mr) => mr.author !== persona.username);
    for (let i = 0; i < persona.emojiGiven; i++) {
      const mr = pick(gr, others);
      const at = withinYear(mr.createdAt + int(gr, 10, 48 * 60) * MINUTE);
      emojis.push({ giver: persona.username, mr, at, name: weighted(gr, EMOJI_NAMES) });
    }
  }

  // 3. Output per persona.
  const activities: Record<string, RawActivity> = {};
  for (const draft of drafts) {
    const me = draft.persona.username;
    const myMrs = draft.mrs.sort((a, b) => a.createdAt - b.createdAt);
    const myCommits = draft.commits.map((c) => c.value.raw);
    const myPipelines = draft.pipelines.map((x) => x.value.raw);

    const approvalsGiven: (RawApprovalGiven & { at: number })[] = [];
    for (const mr of allMrs) {
      for (const approval of mr.approvals) {
        if (approval.user !== me) continue;
        approvalsGiven.push({
          projectPath: mr.project.path,
          mrIid: mr.iid,
          mrAuthor: mr.author,
          mrCreatedAt: toIso(mr.createdAt),
          approvedAt: toIso(approval.at),
          mrChangedLines: mr.changedLines,
          at: approval.at,
        });
      }
    }

    const myNotes: RawNote[] = notes
      .filter((n) => n.writer === me)
      .sort((a, b) => a.at - b.at)
      .map((n) => ({
        createdAt: toIso(n.at),
        noteableType: 'MergeRequest',
        bodyLength: n.bodyLength,
        projectPath: n.mr.project.path,
        counterpart: n.mr.author,
      }));

    const emojiGiven: RawEmojiGiven[] = emojis
      .filter((e) => e.giver === me)
      .sort((a, b) => a.at - b.at)
      .map((e) => ({
        name: e.name,
        awardedAt: toIso(e.at),
        awardableType: 'MergeRequest',
        counterpart: e.mr.author,
      }));

    const emojiReceived: (RawEmojiReceived & { at: number })[] = emojis
      .filter((e) => e.mr.author === me)
      .map((e) => ({
        name: e.name,
        awardedAt: toIso(e.at),
        awardableType: 'MergeRequest',
        from: e.giver,
        at: e.at,
      }));

    const mergeRequests: RawMergeRequest[] = myMrs.map((mr) => ({
      iid: mr.iid,
      projectPath: mr.project.path,
      createdAt: toIso(mr.createdAt),
      updatedAt: toIso(mr.updatedAt),
      mergedAt: mr.mergedAt === null ? null : toIso(mr.mergedAt),
      closedAt: mr.closedAt === null ? null : toIso(mr.closedAt),
      firstApprovedAt: mr.approvals.length
        ? toIso(Math.min(...mr.approvals.map((a) => a.at)))
        : null,
      state: mr.state,
      isDraft: false,
      targetBranch: 'main',
      changedLines: mr.changedLines,
      descriptionLength: mr.descriptionLength,
      reviewers: mr.reviewers,
      approvedBy: [...mr.approvals].sort((a, b) => a.at - b.at).map((a) => a.user),
      notesCount: notes.filter((n) => n.mr === mr).length,
    }));

    // Progetti toccati dalla persona (anche come autrice di MR o di issue).
    const usedPaths = new Set<string>([
      ...myCommits.map((c) => c.projectPath),
      ...mergeRequests.map((m) => m.projectPath),
      ...draft.deployments.map((x) => x.value.projectPath),
      ...draft.issues.map((x) => x.value.projectPath),
    ]);
    const projects: RawProject[] = PROJECTS.filter((p) => usedPaths.has(p.path))
      .sort((a, b) => a.id - b.id)
      .map((p) => ({
        id: p.id,
        path: p.path,
        defaultBranch: 'main',
        languages: p.languages,
        lastActivityBeforeYearAt: p.lastActivityBeforeYearAt,
      }));

    activities[me] = {
      schemaVersion: 1,
      member: { username: me, displayName: draft.persona.displayName },
      year: TEAM_YEAR,
      projects,
      commits: myCommits,
      mergeRequests,
      approvalsGiven: approvalsGiven
        .sort((a, b) => Date.parse(a.approvedAt) - Date.parse(b.approvedAt))
        .map(stripAt),
      pipelines: myPipelines.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      deployments: draft.deployments.sort((a, b) => a.at - b.at).map((x) => x.value),
      notes: myNotes,
      emojiGiven,
      emojiReceived: emojiReceived
        .sort((a, b) => a.awardedAt.localeCompare(b.awardedAt))
        .map(stripAt),
      issueEvents: draft.issues.sort((a, b) => a.at - b.at).map((x) => x.value),
      pushEvents: draft.pushes.sort((a, b) => a.at - b.at).map((x) => x.value),
    };
  }

  return { members: TEAM_MEMBERS, activities };
}

function stripAt<T extends { at: number }>(item: T): Omit<T, 'at'> {
  const { at: _at, ...rest } = item;
  return rest;
}
