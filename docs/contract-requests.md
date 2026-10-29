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

## A2 — `zod` come dipendenza di `apps/api`

- **Cosa**: aggiungere `zod` (stessa versione di `packages/contracts`, `^4.6.7`) alle `dependencies` di `apps/api/package.json`.
- **Perché**: il brief chiede di validare la configurazione con zod, ma con pnpm `zod` non è risolvibile da `apps/api` (è dipendenza solo di `packages/contracts`) e il contratto non lo riesporta.
- **Stub adottato nel frattempo**: `apps/api/src/config.ts` valida le variabili a mano (stessi vincoli e stessi messaggi chiari). Si può sostituire con uno schema zod senza cambiare l'interfaccia `loadConfig`.
