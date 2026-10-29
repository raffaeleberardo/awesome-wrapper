# Creare il token GitLab

Git Wrapped mostra **il tuo** anno su GitLab, e solo il tuo. Per capire chi sei usa il token: all'avvio chiede a GitLab a chi appartiene (`GET /user`) e prepara il wrapped di quella persona. Per questo serve un **Personal Access Token** tuo, con il solo scope `read_api`.

Ognuno avvia l'app sul proprio computer (con il [kit](kit.md) o dal repository con `make up`) e inserisce il proprio token nella schermata iniziale. Il token non va condiviso con nessuno, nemmeno con i colleghi del team.

> **Nota sulle versioni.** I nomi dei menu cambiano tra versioni di GitLab. I passi qui sotto descrivono il flusso generale: se una voce non corrisponde a quella che vedi, consulta la documentazione GitLab della tua istanza.

## Creare il token

1. In GitLab, clicca sul tuo avatar e apri **Preferenze > Token di accesso** (in inglese: _Preferences > Access tokens_, a volte _Personal access tokens_).
2. Clicca su **Aggiungi nuovo token**.
3. Dai un nome riconoscibile, per esempio `git-wrapped`.
4. Imposta una **data di scadenza** breve: per un recap annuale bastano pochi giorni o settimane. Quando il token scade l'app risponde con un errore di token non valido, finché non ne crei uno nuovo.
5. Seleziona **un solo scope: `read_api`**. Non servono altri scope.
6. Crea il token e copialo subito: GitLab lo mostra una sola volta.

## Dove metterlo

Nella **schermata iniziale** dell'app (http://localhost:8080): indirizzo di GitLab, gruppo (facoltativo) e token. L'app li verifica subito con GitLab e segnala un token non valido, un token di bot o un gruppo inesistente. Il link «Crea il token su GitLab» apre la pagina dei token della tua istanza con nome e scope già compilati.

Il token resta nella memoria del server locale dell'app, non su disco: al riavvio va reinserito, a meno di attivare «Ricorda su questo browser» (non farlo su un computer condiviso).

In alternativa, per saltare la schermata, nel file `.env` alla radice del repository:

```bash
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
# Facoltativo: limita la lettura a un gruppo e ai suoi sottogruppi.
GITLAB_GROUP=azienda/team
```

Se `GITLAB_GROUP` resta vuoto si leggono tutti i gruppi di cui fai parte (con qualsiasi ruolo, da Guest in su). Con un gruppo impostato si leggono solo i suoi progetti e quelli dei sottogruppi: è il modo più semplice per lasciare fuori progetti personali o di altri team.

Il file `.env` è nel `.gitignore`. Non incollare il token in chat, ticket, screenshot o commit. Se pensi che sia stato esposto, revocalo subito dalla stessa pagina **Token di accesso** e creane un altro.

## Perché non un Group o Project Access Token

I Group Access Token e i Project Access Token non appartengono a una persona: GitLab crea per ciascuno un **utente bot** (con username come `group_123_bot_...` o `project_456_bot_...`). Il wrapped di un bot non ha senso, quindi l'app li rifiuta: `GET /api/me` risponde `403` con codice `bot_token` e l'interfaccia chiede un Personal Access Token.

Lo stesso vale per qualunque account bot o di servizio: il wrapped è sempre di chi possiede il token.

## Cosa può fare

Con `read_api` il token legge quello che tu puoi già leggere su GitLab. L'app usa solo quello che serve al tuo recap, nei gruppi letti:

- i tuoi dati di base (`GET /user`) e i membri dei gruppi, per dare un nome ai colleghi con cui interagisci;
- i progetti dei gruppi e dei sottogruppi;
- i tuoi commit (con messaggi, file toccati e righe aggiunte o rimosse);
- merge request, approvazioni e pipeline;
- deployment;
- eventi di push e di issue;
- reazioni emoji.

## Cosa non può fare, e cosa non legge

- **Non scrive nulla**: non crea commit, commenti, merge request né modifiche di alcun tipo.
- **Vede solo ciò che vedi tu**: progetti a cui non hai accesso, o fuori dal gruppo impostato in `GITLAB_GROUP`, non compaiono nelle statistiche.
- **Non mostra il wrapped di altre persone**: l'API ha una sola rotta per le statistiche, `GET /api/me`, e restituisce solo le tue.
- **Non legge il testo di note e descrizioni**: di quelle conta solo la lunghezza.
- **Non legge i diff per intero**: dei cambiamenti conta solo le righe con TODO, FIXME e XXX.
- **Non tocca il calendario**: il calendario è un file separato, vedi [docs/calendario-outlook.md](calendario-outlook.md).

Se in un progetto le impostazioni di GitLab nascondono alcuni dati (per esempio pipeline o deployment), quei dati mancano: l'app non li inventa e omette i badge che dipendono da essi.

## Errori comuni

- **`unauthorized` (401)**: il token manca, è scritto male, è scaduto o è stato revocato. Creane uno nuovo e inseriscilo con «Cambia GitLab o token» (o aggiorna `.env` e riavvia, se usi quello).
- **`bot_token` (403)**: hai usato un Group o Project Access Token. Serve un Personal Access Token, vedi sopra.
- **`not_found` (404)**: il token è valido ma nei gruppi letti non c'è tua attività leggibile, oppure il gruppo indicato non esiste o il token non può leggerlo. Controlla il gruppo o lascialo vuoto.
- **«Non riesco a parlare con GitLab a questo indirizzo»**: l'URL è sbagliato, il GitLab è raggiungibile solo in VPN, oppure usa un certificato interno (vedi `GITLAB_CA_CERT` qui sotto).

## Istanze self-hosted

- **Indirizzo**: quello della tua istanza, per esempio `https://gitlab.azienda.example`, nella schermata iniziale (o in `GITLAB_URL`). Il default è `https://gitlab.com`.
- **`GITLAB_CA_CERT`**: serve solo se l'istanza usa una CA aziendale non riconosciuta dal sistema. Va incollato il contenuto del certificato della CA in formato PEM, tra virgolette doppie anche su più righe (esempio in `.env.example`). Un percorso di file funziona solo se monti tu il file nel container `api`.
