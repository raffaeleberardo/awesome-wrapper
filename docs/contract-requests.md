# Richieste di modifica ai contratti

I contratti sono congelati a `contracts-v2`. Se ti serve un cambiamento (contratti, interfacce
congelate, nuove dipendenze npm), aggiungi una voce qui sotto e continua con uno stub.
Decide A11 in Fase 2.

Formato:

```md
## AN — titolo breve

- **Cosa**: il cambiamento richiesto (campo, tipo, dipendenza)
- **Perché**: cosa non si può fare senza
- **Stub adottato nel frattempo**: come hai proseguito
```

Per evitare conflitti di merge, ogni agente aggiunge le proprie voci in fondo al file.

---

## A3 — recuperi delle pipeline per il premio "Fenice delle pipeline"

- **Cosa**: aggiungere a `pipelineStatsSchema` un campo `recoveries: count` (pipeline `success`
  subito dopo una `failed` sullo stesso progetto e ref, in ordine cronologico).
- **Perché**: `pipeline_phoenix` ("più pipeline verdi subito dopo una rossa") si calcola solo da
  `WrappedStats`, che oggi non contiene questo dato. Il motore lo saprebbe calcolare da
  `RawActivity`.
- **Stub adottato nel frattempo**: il premio `pipeline_phoenix` viene sempre omesso (premio senza
  dati = omesso, come da contratto).
- **Decisione A11**: accettata in `contracts-v2`. `pipelines.recoveries: count.default(0)`
  (additiva: un payload v1 senza il campo vale 0). Calcolata in `packages/stats/src/pipelines.ts`
  (stessi progetto e ref, solo `success`/`failed` contano); `pipeline_phoenix` ora assegnato
  (con i dati demo: Marco Vitale). **Motivo**: dato reale già presente in `RawActivity`, il premio
  restava sempre vuoto.

## A3 — orario preciso del primo commit del mattino per "Mattiniero del team"

- **Cosa**: un nuovo `EpicMomentKind` `earliest_morning_commit` (minuti dalla mezzanotte del commit
  più presto dalle 05:00 in poi), oppure un campo equivalente in `WrappedStats`.
- **Perché**: `first_light` ("il commit più presto dell'anno") oggi si ricava dall'istogramma
  `hours`, quindi ha precisione all'ora e produce facilmente pari merito.
- **Stub adottato nel frattempo**: `first_light` usa la prima ora tra 05 e 11 con commit
  (`value` = ora, `detail` = `HH:00`).
- **Decisione A11**: accettata in `contracts-v2` come nuovo `EpicMomentKind`
  `earliest_morning_commit` (minuti dalla mezzanotte, commit tra 05:00 e 11:59). `first_light`
  usa quel momento: `value` = minuti, `detail` = `HH:MM`. Il testo di A4 parlava del «primo
  commit dell'anno»: corretto in «commit più mattiniero dell'anno, alle {detail}». **Motivo**:
  l'ora intera produceva pari merito e un orario poco credibile; il frontend non mostra i
  momenti epici, quindi il nuovo valore dell'enum non tocca le card.

## A1 — Force push: dato derivabile solo in modo euristico

- **Cosa**: opzionale, un campo `isForcePush: boolean | null` in `rawPushEventSchema`, oppure nulla (si tiene il badge "Revisionista storico" sostituito).
- **Perché**: GitLab NON espone un flag di force push negli eventi utente (`push_data` ha solo `action`, `ref_type`, `ref`, `commit_count`, `commit_from`, `commit_to`) né nei webhook. Si potrebbe dedurre un push non fast-forward con `GET /projects/:id/repository/merge_base?refs[]=commit_from&refs[]=commit_to` (se il merge base non è `commit_from`, la storia è stata riscritta), ma costa una chiamata per push e `commit_from` può non esistere più nel repository (404), quindi il dato non è affidabile.
- **Stub adottato nel frattempo**: nessun campo; il collettore non inventa il dato. Raccomandazione: A0/A3 mantengano la sostituzione del badge; se si vuole l'euristica, il campo deve essere `nullable` ("sconosciuto").
- **Decisione A11**: respinta, nessun cambio. **Motivo**: dato non affidabile (merge base su
  commit che possono non esistere più) e una chiamata in più per push; il badge "Revisionista
  storico" è già fuori dal catalogo (regola 6 del piano: mai inventare un dato).

## A2 — `zod` come dipendenza di `apps/api`

- **Cosa**: aggiungere `zod` (stessa versione di `packages/contracts`, `^4.6.7`) alle `dependencies` di `apps/api/package.json`.
- **Perché**: il brief chiede di validare la configurazione con zod, ma con pnpm `zod` non è risolvibile da `apps/api` (è dipendenza solo di `packages/contracts`) e il contratto non lo riesporta.
- **Stub adottato nel frattempo**: `apps/api/src/config.ts` valida le variabili a mano (stessi vincoli e stessi messaggi chiari). Si può sostituire con uno schema zod senza cambiare l'interfaccia `loadConfig`.
- **Decisione A11**: accettata (non è un cambio di contratto). `zod ^4.6.7` tra le dipendenze di
  `apps/api`; `loadConfig` usa uno schema zod con gli stessi default, vincoli e messaggi (test
  di A2 invariati e verdi). **Motivo**: svista di A0, il piano chiede la validazione con zod.

## A7 — etichette dei numeri nel catalogo testi

- **Cosa**: aggiungere a `UI_KEYS` (e a `packages/copy`) le etichette dei numeri delle card: commit, righe aggiunte/cancellate, MR, approvazioni, note, pipeline, deploy, giorni, review, emoji, riunioni, ore, ecc.
- **Perché**: le card usano oggi etichette tecniche scritte a mano (`commit`, `MR`, `righe +`, `approvazioni`...) perché il catalogo non le prevede; per coerenza di tono e lingua andrebbero in `copy.ui`.
- **Stub adottato nel frattempo**: etichette brevi nel codice di `apps/web/src/cards/specs.tsx`; il nome dei giorni e le date vengono da `Intl` (it-IT). Il campo `placeholder`/`aria-label` "Cerca" della ricerca membri è scritto a mano per lo stesso motivo.
- **Decisione A11**: accettata in `contracts-v2`: `UiKey` `search_members` e 30 chiavi `label_*`,
  con testi in `packages/copy/src/ui.ts` (tono neutro, senza accordo di genere né di numero).
  Card e pagina Oscar le usano. Restano scritti nel codice i "fatti" letti dagli screen reader
  (`facts` in `specs.tsx`) e i nomi tecnici delle emoji. **Motivo**: coerenza di lingua e tono,
  un solo posto per i testi.

## A9 — Requisiti dei container sull'API (nota per A2 e A11)

Nessun cambio di contratto, solo i requisiti perché `api` parta nel container hardenizzato:

- Ascoltare su `0.0.0.0:3000` (non su localhost), altrimenti Caddy non la raggiunge.
- Esporre `GET /api/health` con 200 (healthcheck con `wget` su `127.0.0.1:3000`).
- Scrivere solo in `/tmp` (filesystem in sola lettura, utente 1000:1000, nessuna capability).
- Leggere solo le variabili di `.env.example`; il bundle esbuild deve contenere tutte le dipendenze (nel runtime c'è solo `dist/`). Se una dipendenza non è impacchettabile va segnalato, perché l'immagine va estesa.
- `GITLAB_CA_CERT` arriva come contenuto PEM nella variabile, non come percorso di file.
- **Decisione A11**: requisiti verificati sul container reale (ascolto su `0.0.0.0:3000`,
  healthcheck verde, filesystem in sola lettura con scrittura solo in `/tmp`, bundle esbuild
  autosufficiente: nessun modulo mancante a runtime). `GITLAB_CA_CERT`: A2 accetta PEM inline o
  percorso; documentato in `.env.example` e `docs/gitlab-token.md` il PEM tra virgolette doppie,
  anche multi-riga (verificato con `docker compose config`); il percorso solo con un mount a cura
  dell'utente. **Motivo**: compose passa la variabile, non monta file.
