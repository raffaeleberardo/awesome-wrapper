# Richieste di modifica ai contratti

I contratti sono congelati a `contracts-v1`. Se ti serve un cambiamento (contratti, interfacce
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

## A3 — orario preciso del primo commit del mattino per "Mattiniero del team"

- **Cosa**: un nuovo `EpicMomentKind` `earliest_morning_commit` (minuti dalla mezzanotte del commit
  più presto dalle 05:00 in poi), oppure un campo equivalente in `WrappedStats`.
- **Perché**: `first_light` ("il commit più presto dell'anno") oggi si ricava dall'istogramma
  `hours`, quindi ha precisione all'ora e produce facilmente pari merito.
- **Stub adottato nel frattempo**: `first_light` usa la prima ora tra 05 e 11 con commit
  (`value` = ora, `detail` = `HH:00`).

## A1 — Force push: dato derivabile solo in modo euristico

- **Cosa**: opzionale, un campo `isForcePush: boolean | null` in `rawPushEventSchema`, oppure nulla (si tiene il badge "Revisionista storico" sostituito).
- **Perché**: GitLab NON espone un flag di force push negli eventi utente (`push_data` ha solo `action`, `ref_type`, `ref`, `commit_count`, `commit_from`, `commit_to`) né nei webhook. Si potrebbe dedurre un push non fast-forward con `GET /projects/:id/repository/merge_base?refs[]=commit_from&refs[]=commit_to` (se il merge base non è `commit_from`, la storia è stata riscritta), ma costa una chiamata per push e `commit_from` può non esistere più nel repository (404), quindi il dato non è affidabile.
- **Stub adottato nel frattempo**: nessun campo; il collettore non inventa il dato. Raccomandazione: A0/A3 mantengano la sostituzione del badge; se si vuole l'euristica, il campo deve essere `nullable` ("sconosciuto").

## A2 — `zod` come dipendenza di `apps/api`

- **Cosa**: aggiungere `zod` (stessa versione di `packages/contracts`, `^4.6.7`) alle `dependencies` di `apps/api/package.json`.
- **Perché**: il brief chiede di validare la configurazione con zod, ma con pnpm `zod` non è risolvibile da `apps/api` (è dipendenza solo di `packages/contracts`) e il contratto non lo riesporta.
- **Stub adottato nel frattempo**: `apps/api/src/config.ts` valida le variabili a mano (stessi vincoli e stessi messaggi chiari). Si può sostituire con uno schema zod senza cambiare l'interfaccia `loadConfig`.
