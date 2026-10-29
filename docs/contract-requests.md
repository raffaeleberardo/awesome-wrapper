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

## A9 — Requisiti dei container sull'API (nota per A2 e A11)

Nessun cambio di contratto, solo i requisiti perché `api` parta nel container hardenizzato:

- Ascoltare su `0.0.0.0:3000` (non su localhost), altrimenti Caddy non la raggiunge.
- Esporre `GET /api/health` con 200 (healthcheck con `wget` su `127.0.0.1:3000`).
- Scrivere solo in `/tmp` (filesystem in sola lettura, utente 1000:1000, nessuna capability).
- Leggere solo le variabili di `.env.example`; il bundle esbuild deve contenere tutte le dipendenze (nel runtime c'è solo `dist/`). Se una dipendenza non è impacchettabile va segnalato, perché l'immagine va estesa.
- `GITLAB_CA_CERT` arriva come contenuto PEM nella variabile, non come percorso di file.
