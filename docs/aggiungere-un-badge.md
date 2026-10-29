# Aggiungere un badge

Un badge è una voce del catalogo che la storia può assegnare a una persona quando i dati lo permettono. Aggiungerne uno tocca più pacchetti, e ogni pacchetto ha il suo pezzo. La lista è in ordine: segui i passi uno dopo l'altro.

## Regole di tono (da leggere prima)

- **Niente badge sul volume di lavoro.** Il numero di commit, di MR o di righe da solo non fa un badge: al massimo lo fa un comportamento riconoscibile.
- **Si prende in giro il comportamento, mai la persona.** Il badge descrive una abitudine, per esempio "committa di notte", non un giudizio su chi la ha.
- **Mai inventare un dato che GitLab non fornisce.** Se il dato manca, il badge non viene assegnato e lo si segnala. Non si stimano valori e non si usano dati esterni.
- **Un badge deve essere divertente anche per chi lo riceve.** Se la battuta funziona solo sugli altri, va riscritta.

## 1. Il catalogo: `packages/contracts`

Aggiungi l'identificativo in `BADGE_IDS` in `packages/contracts/src/catalog.ts`, con il commento che ne dà il nome in italiano:

```ts
export const BADGE_IDS = [
  // ...
  /** Nome del badge */
  'nuovo_badge',
] as const;
```

Il catalogo è congelato: una nuova voce è un **cambiamento dei contratti** e richiede un nuovo tag dei contratti, secondo la procedura del progetto. Le richieste si aprono in [docs/contract-requests.md](contract-requests.md). Il catalogo descritto in [docs/contracts.md](contracts.md) riflette la versione congelata.

## 2. Regola e soglia: `packages/stats`

Implementa la regola che assegna il badge nel motore statistiche, in `packages/stats`, e rendi esplicita la soglia.

- La soglia va scritta **nel codice e in** `packages/stats/BADGES.md`: il documento è la fonte per chi legge, il codice per chi calcola. Se li cambi, cambiano insieme.
- Usa solo dati che `RawActivity` contiene davvero (vedi [docs/contracts.md](contracts.md)).
- Il badge porta un valore (`value`) che la storia può mostrare accanto al nome.

## 3. Testi: `packages/copy`

Aggiungi titolo e descrizione del badge in `packages/copy`. Il catalogo dei testi è esaustivo: se manca una chiave, il test fallisce, quindi il test ti dirà cosa manca.

- Il testo sta su due righe sul telefono.
- Se il testo usa segnaposto, usa solo quelli ammessi per quella sezione (`COPY_PLACEHOLDERS` in `packages/contracts`).

## 4. Profilo demo: `packages/fixtures`

Modifica i dati demo in `packages/fixtures` in modo che **almeno una persona del team finto** riceva il badge. Serve perché i dati finti coprano tutti i badge, anche senza GitLab: il test `packages/stats/test/demo.test.ts` lo verifica su tutto il team finto, anche se la modalità demo mostra il wrapped di un solo membro fisso.

Se il dataset demo è generato con un seed fisso, la modifica deve restare riproducibile: rigenera i dati con lo script del pacchetto, non a mano.

## 5. Test

- **`packages/stats`**: test della regola (caso in cui il badge scatta, caso in cui non scatta, caso con dati mancanti).
- **`packages/contracts`**: i test dei contratti devono passare con il nuovo identificativo.
- **`packages/copy`**: il test sulle chiavi deve passare, quindi il testo c'è.
- Verifica l'insieme con `pnpm test` in locale e con `make test` nel container.

Se hai cambiato gli esempi dei contratti, rigenerali con `pnpm docs:contracts`, invece di modificarli a mano.

## Checklist

- [ ] Identificativo in `BADGE_IDS`, con commento in italiano
- [ ] Regola e soglia in `packages/stats`, documentate in `packages/stats/BADGES.md`
- [ ] Titolo e descrizione in `packages/copy`
- [ ] Almeno una persona nei dati demo di `packages/fixtures` riceve il badge
- [ ] Test verdi (`pnpm test`, `make test`)
- [ ] Nessun dato inventato, nessun giudizio sulla persona
