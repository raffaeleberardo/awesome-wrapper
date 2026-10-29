# Privacy

Git Wrapped è pensato per un team che già vede i propri dati su GitLab. Non crea una copia di quei dati e non ne aggiunge di nuovi. Questo documento spiega cosa entra, dove resta e cosa non viene mai letto o scritto.

## Cosa entra

- **GitLab, via API**, con un token di sola lettura (`read_api`). Il token sta solo nel file `.env` del server. Dettagli in [docs/gitlab-token.md](gitlab-token.md).
- **Il file `.ics` del calendario**, facoltativo, caricato dall'utente. Viene letto solo nel browser (vedi sotto).

## Cosa resta in memoria, e per quanto

- Le statistiche calcolate dal server vivono **solo in RAM**, in una cache a scadenza breve.
- La durata è di **15 minuti** di default, configurabile con `CACHE_TTL_MINUTES`. Alla scadenza i dati vengono scartati.
- Al riavvio del container la cache si svuota comunque.

## Cosa non viene mai letto

- **Il testo di note e descrizioni** (di merge request, issue e commenti): dal server viene conservata solo la **lunghezza** in caratteri.
- **I diff per intero**: dei cambiamenti conta solo le righe con TODO, FIXME e XXX.
- **Il contenuto del calendario**: titoli e descrizioni servono solo a riconoscere le call Teams e vengono poi scartati.

I **messaggi di commit** sono letti, perché sono già visibili a tutto il team. Vengono usati per statistiche come la lunghezza media o le parole più frequenti.

## Cosa non viene mai scritto

- **Nessun database.**
- **Nessun volume.** Il container non ha dati persistenti.
- **Filesystem in sola lettura**, con solo `/tmp` disponibile in scrittura.
- **Nessun file** creato fuori da `/tmp` durante una richiesta.

## Log

- I log non contengono token, header di autorizzazione, username o contenuti (né note, né descrizioni, né messaggi di commit).
- Il logger redige i campi sensibili prima di scrivere.
- Il comando `make logs` mostra i log dei servizi, già privi di dati personali.

## Calendario: solo nel browser

- Il file `.ics` viene letto da un **Web Worker nel browser**, con `ical.js`.
- Il worker non fa richieste di rete.
- Il file non viene inviato al server e non viene salvato dall'app.
- Vedi [docs/calendario-outlook.md](calendario-outlook.md).

## Sicurezza del browser

- **Content Security Policy** con `connect-src 'self'`: la pagina può parlare solo con il proprio server, non con altri domini.
- **Font serviti dal container**: nessuna chiamata a servizi esterni per i caratteri.
- Header di sicurezza impostati da Caddy.

## Condivisione

L'unico dato che esce dall'app è il **PNG di una card**, e lo esporti solo tu, con l'azione di esportazione. Il PNG viene generato nel browser.

## Badge e premi sono giochi

Badge, personalità, oroscopo e premi del team sono pensati per far sorridere, non per valutare le persone. Non misurano produttività e non sono classifiche di lavoro. Le regole di tono per i badge sono in [docs/aggiungere-un-badge.md](aggiungere-un-badge.md).
