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
