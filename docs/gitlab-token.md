# Creare il token GitLab

Git Wrapped legge le attività del team da GitLab con un token. Il token consigliato è un **Group Access Token**: appartiene al gruppo, non a una persona, e può solo leggere.

> **Nota sulle versioni.** I nomi dei menu, i ruoli disponibili e i piani che includono i token cambiano tra versioni e licenze di GitLab. I passi qui sotto descrivono il flusso generale: se una voce non corrisponde a quella che vedi, consulta la documentazione GitLab della tua istanza.

## Cosa serve

- Il percorso del gruppo che contiene i progetti del team, per esempio `azienda/team`.
- Di norma il ruolo **Owner** del gruppo, necessario per creare i token di gruppo.

## Creare il token

1. Apri il gruppo e vai su **Impostazioni > Token di accesso** (in inglese: _Settings > Access tokens_).
2. Clicca su **Aggiungi nuovo token**.
3. Dai un nome riconoscibile, per esempio `git-wrapped`.
4. Imposta una **data di scadenza**. Per un recap annuale conviene una durata breve e ricordarsi della scadenza: quando il token scade, l'app smette di funzionare finché non ne crei uno nuovo.
5. Scegli il **ruolo Reporter**.
6. Seleziona **un solo scope: `read_api`**.
7. Crea il token e copialo subito: GitLab lo mostra una sola volta.

## Dove metterlo

Nel file `.env`, alla radice del repository:

```bash
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_GROUP=azienda/team
```

Il file `.env` è nel `.gitignore`. Non incollare il token in chat, ticket, screenshot o commit. Se pensi che sia stato esposto, revocalo subito dalla stessa pagina **Token di accesso** e creane un altro.

## Cosa può fare

Con `read_api` il token legge, per i membri del gruppo, quello che serve al recap:

- progetti del gruppo e dei sottogruppi;
- commit (con messaggi, file toccati e righe aggiunte o rimosse);
- merge request, approvazioni e pipeline;
- deployment;
- eventi di push e di issue;
- reazioni emoji.

## Cosa non può fare, e cosa non legge

- **Non scrive nulla**: non crea commit, commenti, merge request né modifiche di alcun tipo.
- **Vede solo ciò che il ruolo Reporter vede** nel gruppo: progetti che non sono nel gruppo, o a cui il token non ha accesso, non compaiono nelle statistiche.
- **Non legge il testo di note e descrizioni**: di quelle conta solo la lunghezza.
- **Non legge i diff per intero**: dei cambiamenti conta solo le righe con TODO, FIXME e XXX.
- **Non tocca il calendario**: il calendario è un file separato, vedi [docs/calendario-outlook.md](docs/calendario-outlook.md).

Se in un progetto le impostazioni di GitLab nascondono alcuni dati (per esempio pipeline o deployment), quei dati mancano: l'app non li inventa e omette i badge che dipendono da essi.

## GitLab.com e piani a pagamento

Su GitLab.com la disponibilità dei Group Access Token dipende dal piano del gruppo. Se la voce non compare o è bloccata, verifica il piano nella documentazione GitLab, oppure usa l'alternativa qui sotto.

## Alternativa: Personal Access Token

Se non puoi creare un Group Access Token, puoi usare un **Personal Access Token** con scope `read_api` di un membro del team che abbia almeno il ruolo Reporter sul gruppo. Il risultato è lo stesso, ma con dei compromessi:

- il token è legato a una persona: se quella persona lascia il gruppo o il suo account viene disattivato, il recap si ferma;
- lo scope `read_api` dà in lettura tutto ciò che quell'account può leggere, anche fuori dal gruppo: è più ampio di quello del bot;
- la scadenza e la revoca dipendono da quella persona.

Se usi questa strada, conviene un account dedicato in sola lettura piuttosto che l'account personale di un collega.

## Istanze self-hosted

- **`GITLAB_URL`**: l'indirizzo della tua istanza, per esempio `https://gitlab.azienda.it`. Il default è `https://gitlab.com`.
- **`GITLAB_CA_CERT`**: serve solo se l'istanza usa una CA aziendale non riconosciuta dal sistema. Va indicato il certificato della CA in formato PEM. Il formato esatto (contenuto del certificato o percorso del file) è spiegato in `.env.example`.
