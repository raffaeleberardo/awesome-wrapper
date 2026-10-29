# Git Wrapped — Piano di esecuzione multi-agente

Oct 28, 2026 · @Raffaele

## Obiettivo e vincoli

Costruiamo "Git Wrapped": un recap annuale in stile Spotify Wrapped, il più giocoso possibile, per un team che lavora su GitLab. Si avvia con un solo `docker compose up` e funziona subito anche senza GitLab, grazie alla modalità demo.

**Vincoli non negoziabili**

- **Fonte principale: GitLab via API** (gitlab.com o self-hosted), con un token `read_api`.
- **Calendario opzionale via file .ics**: l'utente esporta il calendario da Outlook e lo carica. Il file viene letto solo nel browser e non viene mai inviato al server.
- **Nessun dato memorizzato**: niente database, niente volumi persistenti, niente log con nomi, token o contenuti. Le statistiche vivono in RAM con una cache a scadenza breve.
- **Tono giocoso**: badge, personalità, premi di team e oroscopo. Mai classifiche di produttività serie.
- **Condivisione**: ogni card è esportabile come PNG. È l'unico dato che esce, e lo decide l'utente.
- **Lingua dell'interfaccia: italiano.**

## Stack scelto

TypeScript ovunque, con un pacchetto di contratti condiviso. È la scelta che permette agli agenti di lavorare in parallelo: una volta congelati i tipi, backend, motore delle statistiche e frontend non dipendono più l'uno dall'altro.

| Livello            | Scelta                                        | Perché                                                                                                 |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Monorepo           | pnpm workspaces                               | Un solo lockfile, pacchetti condivisi, build veloci nei container                                      |
| Contratti          | `zod` + tipi TS in `packages/contracts`       | Unica fonte di verità per API, statistiche e badge; validazione a runtime                              |
| Motore statistiche | TS puro in `packages/stats`                   | Funzioni pure e testabili; gira sia nel server sia nel browser (serve per unire i dati .ics in locale) |
| API                | Node LTS + Fastify + `@gitbeaker/rest`        | Client GitLab maturo con paginazione; Fastify è leggero e veloce                                       |
| Cache              | `lru-cache` in memoria, TTL 15 minuti         | Evita di martellare GitLab senza scrivere nulla su disco                                               |
| Frontend           | React + Vite + Tailwind                       | Ecosistema ampio, build statica servita da un container minimale                                       |
| Animazioni         | Motion (ex Framer Motion) + `canvas-confetti` | Transizioni a storie, numeri che contano, coriandoli sui badge                                         |
| Export card        | `html-to-image`                               | PNG generato nel browser, nessun servizio esterno                                                      |
| Calendario         | `ical.js` in un Web Worker                    | Parsing .ics locale senza bloccare l'interfaccia                                                       |
| Server web         | Caddy                                         | Serve la SPA, fa da reverse proxy verso `/api`, header di sicurezza e CSP in poche righe               |
| Test               | Vitest + Playwright                           | Unit sul motore, end-to-end sul flusso a storie in demo mode                                           |

**Modello di accesso**: un unico token GitLab di gruppo (Group Access Token, scope `read_api`, ruolo Reporter) nel file `.env`. Ogni collega sceglie il proprio nome dalla lista dei membri. I dati GitLab sono già visibili al team, quindi non si espone nulla di nuovo. I font sono serviti dal container, senza chiamate a servizi esterni.

## Architettura

Il confine della privacy è netto: il calendario si elabora nel browser, i dati GitLab passano solo in memoria dentro il container `api`. Due container (`web` con Caddy e la SPA, `api` con Fastify), un servizio esterno (GitLab).

Il motore `packages/stats` è lo stesso nei due punti: nel server calcola le statistiche GitLab, nel browser quelle del calendario.

**Struttura del monorepo**

```text
git-wrapped/
├── apps/
│   ├── api/          # Fastify (A2), collettore GitLab in src/gitlab (A1)
│   └── web/          # React: story (A6), cards e team (A7), calendar (A8)
├── packages/
│   ├── contracts/    # tipi zod condivisi (A0)
│   ├── stats/        # motore statistiche e badge (A3), calendario (A8)
│   ├── copy/         # testi italiani (A4)
│   └── fixtures/     # team finto e .ics di esempio (A5)
├── docker/           # Dockerfile e Caddyfile (A9)
├── e2e/              # Playwright (A11)
├── docs/             # documentazione (A10)
├── compose.yaml
├── Makefile
└── .env.example
```

## Fasi e agenti

Dodici agenti in tre fasi: uno apre, dieci lavorano in parallelo, uno chiude. Il parallelismo regge perché ogni agente possiede cartelle esclusive e nessuno modifica i contratti dopo la Fase 0.

1. **Fase 0 — Fondamenta** (sequenziale): l'Architetto crea lo scheletro del monorepo e congela i contratti. Gate: `pnpm install && pnpm typecheck` passa e il tag `contracts-v1` esiste.
2. **Fase 1 — Costruzione** (10 agenti in parallelo): ognuno lavora sul proprio branch, nelle proprie cartelle. Gate: test del proprio pacchetto verdi e merge request aperta.
3. **Fase 2 — Integrazione e QA** (sequenziale): un agente che non ha scritto codice unisce i branch, esegue gli end-to-end e l'audit privacy. Gate: `docker compose up` parte in demo mode e la checklist finale è tutta spuntata.

| ID  | Agente                     | Modello             | Fase | Cartelle possedute                                                      |
| --- | -------------------------- | ------------------- | ---- | ----------------------------------------------------------------------- |
| A0  | Architetto                 | `claude-opus-5-5`   | 0    | radice, `packages/contracts`                                            |
| A1  | Collettore GitLab          | `claude-sonnet-5-5` | 1    | `apps/api/src/gitlab`                                                   |
| A2  | Server API e privacy       | `claude-sonnet-5-5` | 1    | `apps/api` (escluso `src/gitlab`)                                       |
| A3  | Motore statistiche e badge | `claude-opus-5-5`   | 1    | `packages/stats` (escluso `src/calendar`)                               |
| A4  | Autore comico              | `claude-fable-5-1`  | 1    | `packages/copy`                                                         |
| A5  | Dati demo                  | `claude-haiku-5-5`  | 1    | `packages/fixtures`                                                     |
| A6  | Player a storie            | `claude-opus-5-5`   | 1    | `apps/web/src/story`, `apps/web/src/theme`                              |
| A7  | Card ed export             | `claude-sonnet-5-5` | 1    | `apps/web/src/cards`, `apps/web/src/team`                               |
| A8  | Modulo calendario          | `claude-sonnet-5-5` | 1    | `apps/web/src/calendar`, `packages/stats/src/calendar`                  |
| A9  | Container e DevOps         | `claude-sonnet-5-5` | 1    | `docker/`, `compose.yaml`, `Makefile`, `.gitlab-ci.yml`, `.env.example` |
| A10 | Documentazione             | `claude-haiku-5-5`  | 1    | `README.md`, `docs/`                                                    |
| A11 | Integratore e QA           | `claude-opus-5-5`   | 2    | `e2e/`, più le correzioni di integrazione ovunque                       |

## Brief degli agenti

"Fatto" significa che la definizione di completamento è verificata, non solo che il codice compila.

### A0 — Architetto (Opus 5.5)

- **Compito**: creare il monorepo pnpm con `apps/api`, `apps/web`, `packages/contracts`, `packages/stats`, `packages/copy`, `packages/fixtures`, configurazione TS condivisa, ESLint, Prettier, Vitest.
- **Contratti da definire in zod**: `RawActivity`, `WrappedStats`, `CalendarStats`, `TeamAwards`, cataloghi `BadgeId` e `PersonalityId`, chiavi dei testi, API (`GET /api/health`, `GET /api/members`, `GET /api/wrapped/:username?year=`, `GET /api/team?year=`).
- **Fatto quando**: `pnpm install && pnpm typecheck` passa, ogni pacchetto ha uno stub che compila, esiste `docs/contracts.md` con un esempio JSON per ogni tipo, e il tag `contracts-v1` è creato.

### A1 — Collettore GitLab (Sonnet 5.5)

- **Compito**: dato un gruppo e un anno, scaricare per ogni membro i dati di `RawActivity` con `@gitbeaker/rest`, gestendo paginazione, rate limit (retry con backoff) e progetti nei sottogruppi.
- **Privacy**: il testo di note e descrizioni non viene mai letto oltre il conteggio dei caratteri; i messaggi di commit sì, perché sono già pubblici nel team.
- **Da verificare**: se l'API non distingue in modo affidabile i force push, segnalarlo ad A0 e A3 così il badge "Revisionista storico" viene sostituito invece di inventare il dato.
- **Fatto quando**: i test con risposte HTTP registrate (`msw` o `nock`) coprono paginazione, 429 e progetto vuoto; c'è un'implementazione alternativa che legge da `packages/fixtures` quando `DEMO_MODE=true`.

### A2 — Server API e privacy (Sonnet 5.5)

- **Compito**: server Fastify che espone le quattro rotte, usa A1 per i dati e `packages/stats` per i calcoli, valida le risposte con i contratti.
- **Privacy**: cache `lru-cache` con TTL di 15 minuti e nessuna scrittura su disco; logger `pino` con redazione di token, header di autorizzazione e username; nessun log del corpo delle risposte.
- **Fatto quando**: i test d'integrazione passano in demo mode, `/api/health` risponde, e un test verifica che nessun file venga creato fuori da `/tmp` durante una richiesta.

### A3 — Motore statistiche e badge (Opus 5.5)

- **Compito**: funzioni pure `RawActivity → WrappedStats` e `WrappedStats[] → TeamAwards`. Fuso orario da `TZ` (default `Europe/Rome`). Oroscopo deterministico da hash di username e anno.
- **Badge minimi**: Gufo notturno, Allodola, Distruttore di main, Approvatore cieco, Romanziere, Monaco silenzioso, MR fantasma, Vive pericolosamente, Marie Kondo, Collezionista di TODO, Necromante. Ogni badge ha una soglia esplicita e documentata.
- **Personalità**: assegnata per punteggio su più dimensioni, sempre una per persona, mai "nessuna".
- **Tono**: nessun badge premia o punisce il volume puro di lavoro; i premi di team sono ironici, non classifiche di produttività.
- **Fatto quando**: copertura dei test ≥ 90% su `packages/stats`, e con i dati demo ogni badge viene assegnato ad almeno una persona.

### A4 — Autore comico (Fable 5.1)

- **Compito**: tutti i testi in italiano in `packages/copy`, indicizzati con le chiavi dei contratti: titoli e descrizioni dei badge, le personalità, almeno 40 frasi combinabili per l'oroscopo, i premi in stile notte degli Oscar, i messaggi di caricamento, le frasi di intro e outro.
- **Regole di tono**: si prende in giro il comportamento, mai la persona; niente battute su numeri bassi; autoironia benvenuta; ogni testo sta in 2 righe su telefono.
- **Fatto quando**: ogni chiave del contratto ha un testo, un test fallisce se ne manca una, e ogni testo con variabili usa segnaposto tipizzati.

### A5 — Dati demo (Haiku 5.5)

- **Compito**: un team finto di 8 sviluppatori con nomi inventati, un anno di `RawActivity` generato con seed fisso, profili diversi tra loro in modo che ogni badge e personalità compaia. Più un file `.ics` di esempio con riunioni ricorrenti, call Teams e inviti rifiutati.
- **Fatto quando**: i dati passano la validazione zod e lo script di generazione è riproducibile byte per byte.

### A6 — Player a storie (Opus 5.5)

- **Compito**: il motore delle storie a schermo intero: formato 9:16 centrato su desktop, tap a sinistra e destra, swipe, frecce da tastiera, barre di avanzamento, pausa tenendo premuto, avanzamento automatico. Tema con colori saturi, tipografia grande, numeri che contano.
- **Accessibilità**: rispetto di `prefers-reduced-motion`, focus visibile, testo leggibile da screen reader per ogni card.
- **Fatto quando**: una storia di 3 card finte scorre in tutti i modi di input, e Playwright lo verifica su viewport mobile e desktop.

### A7 — Card ed export (Sonnet 5.5)

- **Compito**: un componente per card, ognuno legge una parte di `WrappedStats`. Sequenza: intro, numeri chiave, repo top, file top, linguaggi, orari, streak, duetto, emoji, messaggi di commit, cimitero delle pipeline, MR fantasma, deploy del venerdì, card calendario (se presenti), personalità, oroscopo, riepilogo finale. Pagina "Notte degli Oscar" con i premi di team.
- **Export**: ogni card e il riepilogo si scaricano come PNG 1080×1920 con `html-to-image`.
- **Fatto quando**: ogni card regge valori a zero e valori estremi senza rompersi, e l'export produce un PNG valido in Playwright.

### A8 — Modulo calendario (Sonnet 5.5)

- **Compito**: zona di caricamento del file `.ics`, parsing in Web Worker con `ical.js` (comprese le ricorrenze), filtro sull'anno, calcolo di `CalendarStats`: ore in riunione, riunione più lunga e più affollata, serie back-to-back, venerdì pomeriggio, quota di call Teams (rilevate dal link nell'evento), rapporto riunioni/commit.
- **Privacy**: il file non lascia il browser; il worker non fa richieste di rete; oggetti e descrizioni servono solo a riconoscere le call Teams e poi vengono scartati.
- **Fatto quando**: i test sul file di esempio di A5 passano, e un test Playwright verifica che durante il caricamento non parta alcuna richiesta di rete.

### A9 — Container e DevOps (Sonnet 5.5)

- **Compito**: Dockerfile multi-stage per `api` e `web`, `compose.yaml`, `Caddyfile`, `Makefile`, `.env.example`, `.gitlab-ci.yml` (lint, test, build delle immagini). Dettagli nella sezione Container.
- **Fatto quando**: da una macchina pulita `make demo` porta l'app su `http://localhost:8080` in demo mode, senza alcun volume.

### A10 — Documentazione (Haiku 5.5)

- **Compito**: `README.md` con avvio in 3 comandi, e in `docs/`: creazione del token GitLab, export del calendario da Outlook, privacy, come aggiungere un badge, architettura.
- **Fatto quando**: ogni comando citato esiste nel `Makefile` e ogni variabile citata esiste in `.env.example`.

### A11 — Integratore e QA (Opus 5.5)

- **Compito**: unire i branch nell'ordine A0 → A5 → A3/A4 → A1/A2 → A6/A7/A8 → A9/A10, risolvere i conflitti, scrivere gli end-to-end del percorso completo e fare l'audit privacy. Lavora con occhi freschi: non ha scritto il codice che verifica.
- **Fatto quando**: tutta la checklist finale è spuntata.

## Container e avvio

Due container, nessun volume, nessun database: si parte con `make demo` senza configurare nulla, e con `make up` dopo aver messo il token in `.env`.

**Immagini**

- `api`: build multi-stage, runtime Node LTS Alpine, utente non root, filesystem in sola lettura, `tmpfs` su `/tmp`, healthcheck su `/api/health`. Porta interna 3000, non esposta.
- `web`: build della SPA con Vite, servita da Caddy che fa anche da reverse proxy di `/api` verso `api`. Unica porta esposta: 8080. Header di sicurezza e CSP con `connect-src 'self'`, così il browser non può parlare con altri domini.

**Bozza di `compose.yaml`** (A9 la rifinisce)

```yaml
services:
  api:
    build: { context: ., dockerfile: docker/api.Dockerfile }
    env_file: .env
    read_only: true
    tmpfs: [/tmp]
    user: '1000:1000'
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health']
      interval: 10s
  web:
    build: { context: ., dockerfile: docker/web.Dockerfile }
    ports: ['8080:8080']
    depends_on:
      api: { condition: service_healthy }
```

**Variabili d'ambiente** (`.env.example`)

| Variabile           | Default              | Uso                                                        |
| ------------------- | -------------------- | ---------------------------------------------------------- |
| `DEMO_MODE`         | `true`               | Usa i dati finti; diventa `false` quando si mette il token |
| `GITLAB_URL`        | `https://gitlab.com` | Istanza GitLab, anche self-hosted                          |
| `GITLAB_TOKEN`      | vuoto                | Group Access Token con scope `read_api`                    |
| `GITLAB_GROUP`      | vuoto                | Percorso del gruppo, per esempio `azienda/team`            |
| `WRAPPED_YEAR`      | `2026`               | Anno raccontato                                            |
| `TZ`                | `Europe/Rome`        | Fuso per orari e badge notturni                            |
| `CACHE_TTL_MINUTES` | `15`                 | Durata della cache in memoria                              |
| `GITLAB_CA_CERT`    | vuoto                | Certificato per istanze interne con CA aziendale           |

**Comandi del `Makefile`**

| Comando     | Cosa fa                                        |
| ----------- | ---------------------------------------------- |
| `make demo` | Avvia con i dati finti, nessuna configurazione |
| `make up`   | Avvia con i dati GitLab reali da `.env`        |
| `make down` | Ferma e rimuove i container                    |
| `make test` | Unit ed end-to-end dentro un container         |
| `make logs` | Log dei servizi (già privi di dati personali)  |

**Documentazione prodotta da A10**: `README.md` (avvio in 3 comandi), `docs/gitlab-token.md`, `docs/calendario-outlook.md`, `docs/privacy.md`, `docs/aggiungere-un-badge.md`, `docs/architettura.md`, `docs/contracts.md` (di A0).

## Regole di coordinamento e checklist

**Regole per tutti gli agenti**

1. Lavori solo nelle cartelle che possiedi; tutto il resto è in sola lettura.
2. I contratti sono congelati al tag `contracts-v1`. Se ti serve un cambiamento, apri una richiesta in `docs/contract-requests.md` e continua con uno stub; decide A11 in Fase 2.
3. Un branch per agente (`agent/a3-stats`) o un worktree dedicato; una merge request alla fine, con la definizione di completamento spuntata nella descrizione.
4. Le dipendenze tra pacchetti passano solo dai contratti: nessun import da un pacchetto che non sia `contracts` o già pubblicato da A0.
5. Nessun dato reale nei test o nei commit: solo `packages/fixtures`.
6. Mai inventare un dato che GitLab non fornisce: se manca, il badge salta e lo si segnala.

**Checklist finale (A11)**

- [ ] `make demo` parte da una macchina pulita e mostra la storia completa
- [ ] `make up` con un token reale genera la storia di almeno due persone e la pagina dei premi
- [ ] Tutti i test unit ed end-to-end sono verdi in CI
- [ ] Nessun volume, nessun file scritto fuori da `/tmp`, nessun database
- [ ] I log non contengono token, username o contenuti (verifica con grep sui log di una sessione completa)
- [ ] Il caricamento del file `.ics` non genera alcuna richiesta di rete
- [ ] Ogni card regge zero attività e attività estrema
- [ ] L'export PNG funziona su Chrome, Firefox e Safari
- [ ] `prefers-reduced-motion` disattiva le animazioni
- [ ] Ogni badge e personalità compare almeno una volta con i dati demo
- [ ] Una rilettura del tono: nessun testo prende in giro una persona per quanto ha lavorato
- [ ] Il README porta all'avvio in 3 comandi senza altre spiegazioni
