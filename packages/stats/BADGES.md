# Badge, personalità e premi — regole del motore (`packages/stats`)

Fonte di verità delle soglie: `BADGE_THRESHOLDS` in `src/badges.ts`. Se cambi un numero là,
aggiornalo qui (e avvisa chi scrive i testi e i dati demo).

## Convenzioni comuni

- **Fuso**: ore e giorni nel fuso `timezone` (default `Europe/Rome`), lunedì = 0. Si considerano
  solo gli eventi che cadono nell'anno raccontato **in quel fuso**.
- **Presente del racconto**: la fine dell'anno (1° gennaio successivo, 00:00 nel fuso). Mai la
  data di oggi.
- **Commit**: "commit" = tutti i commit dell'anno, merge compresi (contano per ore e giorni).
  "Commit non di merge" = base per righe, file, linguaggi, messaggi e TODO (i merge ripetono
  righe già contate e hanno messaggi generati da GitLab).
- **Tono**: nessun badge misura il volume puro di lavoro. Le soglie sono proporzioni o
  comportamenti; i minimi di campione servono solo a evitare falsi positivi.
- **`value`**: la metrica che ha fatto scattare il badge. Le quote sono in `[0, 1]` con due
  decimali (0.23 = 23%), le medie con un decimale.

## Badge

| Badge                                    | Metrica                                                                                                                                                                              | Soglia                    | Minimo di campione                           | `value`                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `night_owl` Gufo notturno                | quota di commit tra le 22:00 e le 04:59                                                                                                                                              | ≥ 0,20                    | ≥ 20 commit                                  | quota (2 decimali)                               |
| `early_bird` Allodola                    | quota di commit tra le 05:00 e le 08:29                                                                                                                                              | ≥ 0,20                    | ≥ 20 commit                                  | quota (2 decimali)                               |
| `main_breaker` Distruttore di main       | pipeline `failed` sul branch di default avviate dalla persona                                                                                                                        | ≥ 5                       | —                                            | numero di pipeline                               |
| `blind_approver` Approvatore cieco       | approvazioni date tra 0 e 5 minuti dopo la creazione della MR, su MR con `mrChangedLines` ≥ 300 (righe ignote = non conta)                                                           | ≥ 3                       | —                                            | numero di approvazioni                           |
| `novelist` Romanziere                    | (a) media caratteri dei messaggi di commit non di merge, **oppure** (b) media `bodyLength` delle note                                                                                | (a) ≥ 120 · (b) ≥ 400     | (a) ≥ 10 commit non di merge · (b) ≥ 10 note | media che ha fatto scattare (a ha la precedenza) |
| `silent_monk` Monaco silenzioso          | media caratteri dei messaggi di commit non di merge (**variante scelta**: messaggi cortissimi)                                                                                       | ≤ 15                      | ≥ 20 commit non di merge                     | media (1 decimale)                               |
| `ghost_mr` MR fantasma                   | MR fantasma (vedi sotto)                                                                                                                                                             | ≥ 2                       | —                                            | numero di MR fantasma                            |
| `lives_dangerously` Vive pericolosamente | `deployments` (solo deploy veri, non pipeline) di venerdì dalle 16:00 alle 23:59                                                                                                     | ≥ 3                       | —                                            | numero di deploy                                 |
| `marie_kondo` Marie Kondo                | (a) righe cancellate / righe aggiunte nei commit non di merge, **oppure** (b) branch cancellati (push `deleted`, `refType: branch`)                                                  | (a) ≥ 1,2 · (b) ≥ 15      | (a) ≥ 500 righe cambiate in totale           | (a) rapporto (2 decimali) · (b) numero di branch |
| `todo_collector` Collezionista di TODO   | Σ `todosAdded` − Σ `todosRemoved` nei commit non di merge                                                                                                                            | ≥ 10                      | —                                            | saldo dei TODO                                   |
| `necromancer` Necromante                 | (a) issue riaperta nell'anno più di 180 giorni dopo l'ultima chiusura, **oppure** (b) primo commit dell'anno su un progetto con `lastActivityBeforeYearAt` più vecchio di 365 giorni | (a) > 180 g · (b) > 365 g | —                                            | giorni del risveglio più lungo (interi)          |
| `polyglot` Poliglotta                    | linguaggi con quota ≥ 5% in `languages`                                                                                                                                              | ≥ 4                       | ≥ 10 commit non di merge                     | numero di linguaggi                              |
| `emoji_overlord` Re delle reazioni       | emoji date nell'anno                                                                                                                                                                 | ≥ 150                     | —                                            | numero di emoji                                  |

Note:

- **`silent_monk`**: delle due varianti proposte è stata scelta quella sui **messaggi di commit
  cortissimi** (media ≤ 15 caratteri, min 20 commit non di merge). L'altra (MR senza descrizione
  e nessuna nota) è scartata: "nessuna nota scritta" è fragile e dipende da quanto GitLab espone.
  `novelist` e `silent_monk` sui commit si escludono a vicenda; una persona può averli entrambi
  solo se è laconica nei commit e prolissa nelle note.
- **Lunghezze**: in caratteri visibili (code point), sul messaggio completo senza spazi iniziali
  e finali.
- **MR fantasma**: MR della persona (a) in stato `opened`, create prima di fine anno, con
  `updatedAt` più vecchio di 30 giorni rispetto a fine anno; oppure (b) in stato `closed` senza
  `mergedAt`, chiuse nell'anno (`closedAt`, o `updatedAt` se manca). `oldestDays` = età della più
  vecchia: da creazione a fine anno per (a), da creazione a chiusura per (b).
- **Necromante (b)**: "inattivo" usa `lastActivityBeforeYearAt`; se è `null` il progetto non conta.

## Altre metriche (`WrappedStats`)

- `hours`, `weekdays`, `months`, `peakHour`, `peakWeekday`: commit dell'anno; picchi a parità
  sull'indice più basso, `null` se nessun commit.
- `streak`: giorni locali consecutivi con almeno un commit; a parità la prima serie.
- `totals.linesAdded` / `linesDeleted`: commit non di merge. `activeDays`: giorni con commit,
  MR aperte, note o approvazioni. `projectsTouched`: progetti distinti in qualunque evento dell'anno.
  `mergeRequestsMerged`: MR con `mergedAt` nell'anno.
- `languages`: un punto per file per commit non di merge, dalla mappa estensione → linguaggio in
  `src/languages.ts` (JSON, YAML, Markdown e simili non contano). Se nessun file è riconosciuto si
  usano le percentuali di `projects[].languages` pesate per i commit sul progetto. Quote
  arrotondate per difetto a 3 decimali (somma ≤ 1), massimo 8.
- `commitMessages`: commit non di merge. `topWords` senza prefisso conventional
  (`feat(x)!:`, `fix:`, `chore:`...), URL, shortcode `:emoji:`, numeri, parole < 3 lettere e
  stopword italiane/inglesi; minuscole, max 10, a parità in ordine alfabetico. `fixCount`: "fix"
  ovunque (anche hotfix, bugfix). `wipCount`: la parola "wip" (non "wipe"). `shortest`: prima riga
  più corta (a parità il primo commit dell'anno).
- `pipelines.successRate`: (totale − fallite) / totale, `null` senza pipeline.
  `longestFailStreak`: fallite consecutive in ordine cronologico; `success` azzera, gli altri stati
  non contano. `graveyard`: fallite sul branch di default prima, poi più lunghe, poi più recenti.
- `fridayDeploys`: `deployments` di venerdì dalle 14:00; se la persona non ha alcun deploy
  nell'anno, pipeline sul branch di default di venerdì dalle 14:00. `latestAt` = quello all'ora
  più tarda (a parità il più recente). Il badge `lives_dangerously` invece parte dalle 16:00 e usa
  solo i deploy.
- `duet`: interazioni con i membri del team (`teamMembers`; se vuoto, chiunque con lo username come
  nome): approvazioni date e ricevute, presenza tra i reviewer delle sue MR, note con
  `counterpart`, emoji date e ricevute. A parità lo username alfabeticamente primo.
- `epicMoments` (unità di `value`): `biggest_commit` righe cambiate (non merge); `first_commit` /
  `last_commit` giorno dell'anno (1 = 1° gennaio); `latest_night_commit` minuti dalla mezzanotte
  (03:12 → 192) del commit tra 22:00 e 04:59 più vicino alle 04:00; `fastest_approval` minuti tra
  creazione e prima approvazione di una MR della persona; `longest_mr` giorni (1 decimale) tra
  creazione e merge; `busiest_day` commit nel giorno più pieno (`at` = primo commit del giorno);
  `earliest_morning_commit` minuti dalla mezzanotte del commit più presto tra 05:00 e 11:59.
- `horoscopeSeed`: FNV-1a 32 bit sui byte UTF-8 di `username + ':' + anno`.

## Personalità

Ogni dimensione ha un punteggio in `[0, 1]` (3 decimali). `fiducia(n, N) = min(1, n / N)` smorza
i punteggi quando il campione è piccolo; `clamp` limita a `[0, 1]`.

| Dimensione      | Formula                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nocturnality`  | clamp(quota commit 22:00–04:59 / 0,35) × fiducia(commit, 10)                                                                                                                                                                                             |
| `collaboration` | s = approvazioni date + note + 0,25 × emoji date; p = commit + MR aperte; clamp((s / (s + p)) / 0,6) × fiducia(s + p, 20)                                                                                                                                |
| `cleanup`       | max( clamp((cancellate / (aggiunte + cancellate) − 0,3) / 0,3) × fiducia(righe, 200), clamp(quota commit "di pulizia" / 0,4) × fiducia(commit non merge, 10) ) — pulizia = refactor, cleanup, remove/rimuovi, elimina, pulizia, semplifica, deprecate... |
| `changeSize`    | f = clamp((file medi per commit − 1) / 9) × fiducia(commit non merge, 5); se ci sono MR con righe note: media(f, clamp(righe medie per MR / 800) × fiducia(MR, 3)), altrimenti f                                                                         |
| `cadence`       | (0,5 × clamp(1 − righe medie per commit / 200) + 0,5 × clamp((commit per giorno con commit − 1) / 5)) × fiducia(commit, 20)                                                                                                                              |
| `verbosity`     | max( clamp((media messaggi − 20) / 100) × fiducia(commit non merge, 10), clamp(media note / 400) × fiducia(note, 10), clamp(media descrizioni MR / 600) × fiducia(MR, 5) )                                                                               |
| `regularity`    | media( clamp((quota commit nella miglior finestra di 3 ore − 0,3) / 0,5), clamp((quota commit lun–ven − 0,7) / 0,3), clamp(1 − coeff. di variazione dei commit lun–ven) ) × fiducia(commit, 20)                                                          |
| `urgency`       | u = clamp(quota commit "da pompiere" / 0,4) × fiducia(commit non merge, 10), con fix/urgent/urgente/asap/revert/rollback/critical; con pipeline: 0,6 × u + 0,4 × clamp(quota pipeline su default / 0,6) × fiducia(pipeline, 10), altrimenti u            |

Punteggio di ogni personalità = combinazione lineare delle dimensioni; vince l'argmax (confronto
a 6 decimali).

| Personalità      | Formula                                |
| ---------------- | -------------------------------------- |
| `architect`      | changeSize − 0,3 × cadence             |
| `firefighter`    | urgency                                |
| `gardener`       | cleanup                                |
| `diplomat`       | collaboration                          |
| `sprinter`       | cadence − 0,3 × changeSize             |
| `philosopher`    | verbosity                              |
| `night_creature` | nocturnality − 0,2 × regularity        |
| `metronome`      | 0,85 × regularity − 0,3 × nocturnality |

**Pareggi** (compresa l'attività zero, dove tutto vale 0): vince la prima di questo ordine:
`philosopher`, `metronome`, `diplomat`, `architect`, `gardener`, `sprinter`, `firefighter`,
`night_creature`. Con attività zero la personalità è quindi sempre `philosopher` ("sta ancora
pensando"): mai "nessuna".

Il peso 0,85 su `regularity` evita che chiunque lavori in orario d'ufficio diventi Metronomo:
basta un tratto netto in un'altra dimensione per prevalere.

## Premi di team (`computeTeamAwards`)

Calcolati solo dalle `WrappedStats` dell'anno richiesto. Pari merito ammessi (vincitori in ordine
di username; `value` e `detail` del primo). Un premio senza candidati viene omesso.

| Premio              | Regola                                                                                                                                                                   | `value`                 | `detail`        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------- |
| `best_duet`         | coppia (persona, partner del duetto) con più interazioni; tra le due metà si tiene il conteggio più alto; a parità la coppia alfabeticamente prima. Sempre due vincitori | interazioni             | —               |
| `night_shift`       | `latest_night_commit` più vicino alle 04:00                                                                                                                              | minuti dalla mezzanotte | orario `HH:MM`  |
| `pipeline_phoenix`  | `pipelines.recoveries` più alto (> 0): pipeline `success` subito dopo una `failed` sullo stesso progetto e ref (`contracts-v2`)                                          | rinascite               | —               |
| `emoji_of_the_year` | emoji con più usi sommando i `topGiven` del team; vince chi l'ha usata di più                                                                                            | usi del vincitore       | nome dell'emoji |
| `marathon_mr`       | massimo tra `longest_mr` e `ghostMrs.oldestDays`                                                                                                                         | giorni                  | —               |
| `hemingway`         | `commitMessages.shortest` più corto (non vuoto)                                                                                                                          | caratteri               | il messaggio    |
| `tolstoy`           | `commitMessages.longestLength` più alto                                                                                                                                  | caratteri               | —               |
| `golden_broom`      | rapporto righe cancellate / aggiunte più alto (min 500 righe cambiate, almeno una cancellata)                                                                            | rapporto (2 dec.)       | —               |
| `friday_courage`    | `fridayDeploys.count` più alto (> 0)                                                                                                                                     | deploy                  | —               |
| `first_light`       | momento epico `earliest_morning_commit` più presto (commit tra 05:00 e 11:59, al minuto; `contracts-v2`)                                                                 | minuti dalla mezzanotte | orario `HH:MM`  |
