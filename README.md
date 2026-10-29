# Git Wrapped

Il recap annuale del team, in stile Spotify Wrapped: storie a schermo intero con le tue statistiche GitLab, badge curiosi, una personalità tutta tua, un oroscopo e la notte degli Oscar del team. Funziona subito, anche senza GitLab, grazie ai dati finti della modalità demo.

## Avvio in 3 comandi

```bash
git clone <URL-del-repo> git-wrapped
cd git-wrapped
make demo
```

Poi apri **http://localhost:8080** nel browser. Serve Docker, vedi [Requisiti](#requisiti).

La modalità demo usa un team inventato: nessun token, nessuna configurazione.

## Passare ai dati reali

1. Crea il file di configurazione: `cp .env.example .env`
2. Apri `.env` e compila `GITLAB_TOKEN` (un Group Access Token con scope `read_api`) e `GITLAB_GROUP` (il percorso del gruppo, per esempio `azienda/team`). Non serve toccare `DEMO_MODE`: `make up` usa sempre i dati reali, `make demo` sempre quelli finti.
3. Avvia con `make up` e apri http://localhost:8080.

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

Le variabili d'ambiente sono documentate in `.env.example`: le principali sono `DEMO_MODE`, `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_GROUP`, `WRAPPED_YEAR`, `TZ`, `CACHE_TTL_MINUTES` e `GITLAB_CA_CERT`.

## Privacy in breve

- Il token GitLab è di sola lettura (`read_api`) e sta solo nel tuo `.env`.
- Le statistiche restano in memoria per 15 minuti (`CACHE_TTL_MINUTES`). Non c'è un database, non ci sono volumi, e nulla viene scritto su disco.
- Il calendario `.ics` viene letto solo nel browser e non viene mai inviato al server.
- I PNG si scaricano solo quando lo scegli tu: è l'unico dato che esce dall'app.
- Badge e premi sono giochi, non metriche di produttività.

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
│   └── web/          # SPA React: storie, card, premi del team, calendario
├── packages/
│   ├── contracts/    # schemi zod condivisi: fonte di verità per API e statistiche
│   ├── stats/        # motore statistiche e badge; anche il calendario, che gira nel browser
│   ├── copy/         # testi in italiano
│   └── fixtures/     # team finto e file .ics di esempio
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
