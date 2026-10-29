# Il kit: usare l'app senza il codice

Chi vuole solo vedere il proprio wrapped non ha bisogno di Git, Node.js o del repository: basta il **kit**, uno zip di pochi KB con tre file. Le immagini Docker già pronte si scaricano da GitHub Container Registry (`ghcr.io/raffaeleberardo`), che è pubblico.

| File           | A cosa serve                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `compose.yaml` | Avvia i due container (`git-wrapped-api` e `git-wrapped-web`) usando le immagini pubblicate.     |
| `LEGGIMI.txt`  | Istruzioni passo passo per chi riceve lo zip.                                                    |
| `env.example`  | Facoltativo: opzioni avanzate (certificato aziendale, anno, impostazioni per saltare la pagina). |

I sorgenti del kit stanno in [`kit/`](../kit) e sono versionati con il resto del progetto.

## Per chi riceve lo zip

Serve solo Docker Desktop (o un'alternativa compatibile, vedi sotto).

1. Scompatta lo zip in una cartella.
2. Apri un terminale in quella cartella e lancia `docker compose up -d`.
3. Apri http://localhost:8080 e inserisci indirizzo di GitLab, gruppo (facoltativo) e il tuo Personal Access Token `read_api`. Per provare senza token: «Prova con dati inventati».

Per aggiornare all'ultima versione: `docker compose pull && docker compose up -d`. Per fermare: `docker compose down`.

L'app ascolta solo su `127.0.0.1:8080`: chi è sulla stessa rete (per esempio il Wi-Fi dell'ufficio) non può aprirla.

### Windows

- Le immagini esistono per `amd64` (quasi tutti i PC) e `arm64` (portatili con chip Snapdragon): Docker sceglie quella giusta.
- I comandi sono gli stessi in PowerShell, nel Prompt dei comandi e nel Terminale. Per aprire il terminale nella cartella: tasto destro sulla cartella scompattata, «Apri nel Terminale».
- Se serve il file `.env` (solo per le opzioni avanzate), crealo dal terminale: `copy env.example .env`. Esplora file a volte non accetta nomi che iniziano con il punto.
- Docker Desktop richiede WSL2 e, di solito, i permessi da amministratore: su PC gestiti dall'IT potrebbe servire una richiesta.

### Problemi comuni

- **`denied` o `unauthorized` scaricando le immagini**: i pacchetti su GitHub non sono pubblici (vedi sotto, «La prima volta»), oppure un proxy aziendale blocca `ghcr.io`. In quel caso configura il proxy nelle impostazioni di Docker Desktop.
- **«Non riesco a parlare con GitLab a questo indirizzo»**: l'URL è sbagliato, oppure il GitLab aziendale è raggiungibile solo in VPN, oppure usa un certificato interno: metti il PEM in `GITLAB_CA_CERT` nel `.env` e riavvia con `docker compose up -d --force-recreate`.
- **La pagina non si apre**: `docker compose ps` mostra lo stato dei container, `docker compose logs api` il motivo (i log non contengono mai il token).

### Licenza di Docker Desktop

Docker Desktop è gratuito per uso personale, istruzione, open source e aziende piccole (sotto i 250 dipendenti **e** sotto i 10 milioni di dollari di fatturato annuo); oltre serve un abbonamento. Le condizioni possono cambiare: verificale sul sito di Docker. Alternative gratuite che supportano `docker compose`: Rancher Desktop e Podman Desktop (il kit non è stato provato su queste).

## Per chi pubblica una nuova versione

Tutto passa da un comando: **`make kit`**, che esegue [`scripts/publish-kit.sh`](../scripts/publish-kit.sh).

| Hai cambiato…         | Cosa fare                                       |
| --------------------- | ----------------------------------------------- |
| il codice dell'app    | commit, poi `make kit`                          |
| solo i file in `kit/` | commit, poi `scripts/publish-kit.sh --zip-only` |

Il risultato è `dist/git-wrapped-kit.zip` (la cartella `dist/` è esclusa da Git): è il file da mandare.

### Cosa fa `make kit`

1. **Controlla che non ci siano modifiche non committate.** Le immagini devono corrispondere a un commit preciso: se il working tree non è pulito lo script si ferma.
2. **Costruisce e pubblica le due immagini**, `git-wrapped-api` e `git-wrapped-web`, con `docker buildx build`:
   - per due architetture, `linux/amd64` e `linux/arm64` (su un Mac con chip Apple la prima si compila in emulazione, quindi ci vuole qualche minuto);
   - con due tag: l'hash corto del commit (es. `13470f1`), che non cambia più, e `latest`, che si sposta sull'ultima versione ed è quello che scarica il kit;
   - con le etichette OCI `org.opencontainers.image.source` (collega il pacchetto a questo repository su GitHub) e `org.opencontainers.image.revision` (il commit);
   - con `--push`, che le carica su `ghcr.io/raffaeleberardo`.
3. **Crea lo zip**: entra in `kit/` e comprime esattamente `compose.yaml`, `env.example` e `LEGGIMI.txt` con `zip -X` (senza gli attributi extra del Mac). I file sono elencati per nome, così nello zip non finisce nient'altro per sbaglio, per esempio un `.env` con un token o i `.DS_Store`.

Per controllare lo zip senza scompattarlo: `unzip -l dist/git-wrapped-kit.zip`.

### La prima volta

1. **Login al registry.** Crea un token GitHub (classic) con il solo scope `write:packages` e una scadenza breve, poi, dal tuo terminale (non incollarlo in chat):

   ```bash
   docker login ghcr.io -u <tuo-utente-github>
   ```

   e incolla il token come password. Il login resta salvato in Docker; puoi revocare il token quando non pubblichi più.

2. **Pubblica** con `make kit`.
3. **Rendi pubblici i pacchetti.** I pacchetti nuovi su GitHub nascono privati: per ciascuno (`git-wrapped-api` e `git-wrapped-web`) apri la pagina del pacchetto dal tuo profilo GitHub (scheda _Packages_), poi **Package settings** > **Danger Zone** > **Change visibility** > **Public**. Va fatto una volta sola.

Per verificare che un utente non autenticato possa scaricarle, basta provare il kit da un'altra macchina, oppure con un `DOCKER_CONFIG` vuoto.

### Fork

Chi parte da un fork deve cambiare il nome del registry: `REGISTRY` e `SOURCE` in `scripts/publish-kit.sh` e i due `image:` in `kit/compose.yaml`.
