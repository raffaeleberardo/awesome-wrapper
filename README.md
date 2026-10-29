# Git Wrapped

Il tuo anno su GitLab, in stile Spotify Wrapped: storie a schermo intero con le tue statistiche, badge curiosi, una personalità tutta tua e un oroscopo. Funziona subito, anche senza GitLab, grazie ai dati finti della modalità demo.

L'app mostra solo il wrapped di chi la avvia: riconosce la persona dal token GitLab, non c'è una lista di colleghi da sfogliare. È pensata per girare in locale: ognuno clona il repository, mette il proprio token nel proprio `.env` e la avvia sul proprio computer.

## Avvio in 3 comandi

```bash
git clone <URL-del-repo> git-wrapped
cd git-wrapped
make demo
```

Poi apri **http://localhost:8080** nel browser. Serve Docker, vedi [Requisiti](#requisiti).

La modalità demo mostra il wrapped di una persona inventata (Giulia Ferri, da un team finto di otto): nessun token, nessuna configurazione.

## Passare ai dati reali

1. Crea il file di configurazione: `cp .env.example .env`
2. Apri `.env` e compila `GITLAB_TOKEN` con il **tuo Personal Access Token** (scope `read_api`) e, se vuoi limitarti a un gruppo, `GITLAB_GROUP` (il percorso, per esempio `azienda/team`; se resta vuoto si leggono tutti i gruppi di cui fai parte). I Group e Project Access Token non vanno bene: appartengono a un bot, e il wrapped è di una persona. Non serve toccare `DEMO_MODE`: `make up` usa sempre i dati reali, `make demo` sempre quelli finti.
3. Avvia con `make up` e apri http://localhost:8080: vedrai il wrapped della persona a cui appartiene il token.

Come creare il token: [docs/gitlab-token.md](docs/gitlab-token.md). Il file `.env` è escluso da Git: non committarlo.

Il calendario Outlook è facoltativo: si carica dalla pagina del calendario, vedi [docs/calendario-outlook.md](docs/calendario-outlook.md).

## Requisiti

- **Docker** con **Docker Compose v2**. Verifica con `docker compose version`.
- **make**. Su Windows non è incluso di default: usa WSL2, installalo a parte, oppure lancia direttamente `docker compose up -d --build --wait` (demo) e `docker compose down` per fermare. Per i dati reali senza make metti `DEMO_MODE=false` in `.env`.
- Solo per lo sviluppo locale senza Docker: **Node.js 22** o successivo e **pnpm 10** (la versione è fissata in `package.json`).

## Comandi del Makefile

| Comando     | Cosa fa                                        |
| ----------- | ---------------------------------------------- |
| `make demo` | Avvia con i dati finti, nessuna configurazione |
| `make up`   | Avvia con i dati GitLab reali da `.env`        |
| `make down` | Ferma e rimuove i container                    |
| `make test` | Unit ed end-to-end dentro un container         |
| `make logs` | Log dei servizi (già privi di dati personali)  |
| `make kit`  | Pubblica le immagini e crea lo zip del kit     |

Le variabili d'ambiente sono documentate in `.env.example`: le principali sono `DEMO_MODE`, `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_GROUP`, `WRAPPED_YEAR`, `TZ`, `CACHE_TTL_MINUTES` e `GITLAB_CA_CERT`.

## Condividere l'app senza Git

Chi vuole solo usare l'app non ha bisogno del codice: basta il **kit** in `kit/` (un `compose.yaml` che scarica le immagini già pronte da `ghcr.io/raffaeleberardo`, `env.example` e `LEGGIMI.txt`). Si manda lo zip in chat e ognuno, con solo Docker, mette il proprio token nel suo `.env` e lancia `docker compose up -d`.

Per pubblicare una nuova versione: fai il commit, poi `make kit`. Lo script `scripts/publish-kit.sh` costruisce le immagini per `amd64` e `arm64`, le carica con il tag del commit e `latest`, e crea `dist/git-wrapped-kit.zip`. La prima volta serve `docker login ghcr.io` con un token GitHub con scope `write:packages`, e dopo il primo caricamento i due pacchetti vanno resi pubblici dalle impostazioni del pacchetto su GitHub. Chi ha già il kit aggiorna con `docker compose pull && docker compose up -d`.

## Privacy in breve

- Il token GitLab è tuo, di sola lettura (`read_api`) e sta solo nel tuo `.env`, sul tuo computer.
- L'app mostra solo il tuo wrapped: non esiste una rotta per leggere le statistiche di altre persone.
- Le statistiche restano in memoria per 15 minuti (`CACHE_TTL_MINUTES`). Non c'è un database, non ci sono volumi, e nulla viene scritto su disco.
- Il calendario `.ics` viene letto solo nel browser e non viene mai inviato al server.
- I PNG si scaricano solo quando lo scegli tu: è l'unico dato che esce dall'app.
- Badge, personalità e oroscopo sono giochi, non metriche di produttività.

Dettagli: [docs/privacy.md](docs/privacy.md).

## Sviluppo locale senza Docker

```bash
pnpm install
pnpm --filter @git-wrapped/api dev    # API su http://localhost:3000
pnpm --filter @git-wrapped/web dev    # interfaccia su http://localhost:5173, con /api inoltrato alla porta 3000
pnpm test
pnpm typecheck
pnpm lint
```

## Struttura del monorepo

```text
git-wrapped/
├── apps/
│   ├── api/          # server Fastify: rotte, cache, collettore GitLab (src/gitlab)
│   └── web/          # SPA React: storie, card, calendario
├── packages/
│   ├── contracts/    # schemi zod condivisi: fonte di verità per API e statistiche
│   ├── stats/        # motore statistiche e badge; anche il calendario, che gira nel browser
│   ├── copy/         # testi in italiano
│   └── fixtures/     # team finto (per la demo) e file .ics di esempio
├── docker/           # Dockerfile di api e web, Caddyfile
├── e2e/              # test end-to-end con Playwright
├── docs/             # documentazione
├── compose.yaml
├── Makefile
└── .env.example
```

Le soglie dei badge sono in [packages/stats/BADGES.md](packages/stats/BADGES.md).

## Documentazione

- [Creare il token GitLab](docs/gitlab-token.md)
- [Esportare il calendario da Outlook](docs/calendario-outlook.md)
- [Privacy](docs/privacy.md)
- [Aggiungere un badge](docs/aggiungere-un-badge.md)
- [Architettura](docs/architettura.md)
- [Contratti: badge, API e interfacce](docs/contracts.md)
- [Richieste di modifica ai contratti](docs/contract-requests.md)
- [Piano di esecuzione](docs/piano.md)
