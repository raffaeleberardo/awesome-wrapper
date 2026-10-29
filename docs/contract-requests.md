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

## A7 — etichette dei numeri nel catalogo testi

- **Cosa**: aggiungere a `UI_KEYS` (e a `packages/copy`) le etichette dei numeri delle card: commit, righe aggiunte/cancellate, MR, approvazioni, note, pipeline, deploy, giorni, review, emoji, riunioni, ore, ecc.
- **Perché**: le card usano oggi etichette tecniche scritte a mano (`commit`, `MR`, `righe +`, `approvazioni`...) perché il catalogo non le prevede; per coerenza di tono e lingua andrebbero in `copy.ui`.
- **Stub adottato nel frattempo**: etichette brevi nel codice di `apps/web/src/cards/specs.tsx`; il nome dei giorni e le date vengono da `Intl` (it-IT). Il campo `placeholder`/`aria-label` "Cerca" della ricerca membri è scritto a mano per lo stesso motivo.
