# Esportare il calendario da Outlook

Il calendario è **facoltativo**. Senza, il recap funziona comunque. Con il file `.ics` l'app aggiunge statistiche su riunioni, call Teams e inviti rifiutati.

> **Nota sulle versioni.** Le voci di menu di Outlook cambiano tra versioni, lingue e licenze. Se un'opzione non corrisponde a quella descritta qui, cerca _Calendario_, _Condividi_ o _Pubblica_ nelle impostazioni, oppure usa la ricerca di Outlook. Nelle organizzazioni aziendali un amministratore può limitare la pubblicazione dei calendari.

## Outlook classico per Windows

1. Vai su **File > Apri ed esporta > Salva calendario** (in inglese: _File > Open & Export > Save Calendar_; il nome della voce può variare).
2. Scegli il calendario da salvare e l'intervallo di date. Per il recap conviene l'intero anno raccontato.
3. Attiva l'opzione **Includi dettagli**. Senza dettagli, le call Teams potrebbero non essere riconosciute, perché il riconoscimento usa il link che sta nell'evento.
4. Salva il file con estensione `.ics`.

## Outlook sul web

1. Apri le impostazioni (icona dell'ingranaggio) e vai su **Calendario > Calendari condivisi** (in inglese: _Shared calendars_).
2. Nella sezione **Pubblica un calendario** scegli il calendario da pubblicare.
3. Scegli il livello di dettaglio. Per il riconoscimento delle call Teams serve un livello che includa i dettagli degli eventi: un livello che mostra solo la disponibilità non è sufficiente.
4. Pubblica e copia il **link ICS**.
5. Apri il link ICS nel browser: si scarica il file `.ics`.

Chi ha il link può leggere il calendario con il livello di dettaglio scelto. Dopo l'uso, rimuovi la pubblicazione.

## Nuovo Outlook per Windows

Il nuovo Outlook espone la pubblicazione in _Impostazioni > Calendario > Calendari condivisi_, con passi simili a quelli di Outlook sul web. Alcune funzioni di esportazione possono non essere disponibili: in quel caso usa Outlook sul web.

## Caricare il file nell'app

Apri la pagina del calendario dell'app e seleziona il file `.ics` (o trascinalo nella finestra). Il nome esatto della sezione e del pulsante è un dettaglio dell'interfaccia e può cambiare.

## Cosa viene calcolato

Dal file l'app calcola queste statistiche per l'anno raccontato:

- ore passate in riunione;
- la riunione più lunga e la più affollata (per numero di partecipanti);
- la serie di riunioni in fila senza pause (back-to-back) più lunga;
- le riunioni del venerdì pomeriggio;
- la quota di call Teams;
- la quota di riunioni ricorrenti;
- gli inviti rifiutati;
- il rapporto tra riunioni e commit, se i commit dell'anno sono noti.

I conteggi dipendono da ciò che è presente nel file: per esempio gli inviti rifiutati e il numero dei partecipanti compaiono solo se Outlook li esporta.

## Se il file non viene letto

L'app accetta gli export reali, anche quelli imperfetti:

- codifica UTF-8 (con o senza BOM), UTF-16 e Windows-1252;
- a capo in stile Windows, Mac o Linux, righe vuote e spazi in fondo alle righe;
- testo andato a capo senza la piegatura prevista dal formato, e virgolette non chiuse nei partecipanti;
- più calendari nello stesso file.

Un singolo evento illeggibile (per esempio con una data vuota) viene saltato senza scartare il resto. Se compare comunque «Non riesco a leggere questo file», di solito il file non è un calendario: controlla che inizi con `BEGIN:VCALENDAR` (si apre con un editor di testo) e che non sia un collegamento o un file `.msg`/`.pst`. Il limite è di 20 MB e 20.000 riunioni nell'anno.

## Cosa non viene letto e cosa non esce dal browser

- Il file viene elaborato da un **Web Worker nel browser**. Il worker non fa richieste di rete.
- Il file **non viene mai inviato al server** e l'app **non lo salva**.
- Titoli e descrizioni degli eventi servono solo a riconoscere le call Teams e poi vengono scartati. Non compaiono nelle statistiche.

Puoi cancellare il file `.ics` quando hai finito.
