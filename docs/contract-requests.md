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

## A1 — Force push: dato derivabile solo in modo euristico

- **Cosa**: opzionale, un campo `isForcePush: boolean | null` in `rawPushEventSchema`, oppure nulla (si tiene il badge "Revisionista storico" sostituito).
- **Perché**: GitLab NON espone un flag di force push negli eventi utente (`push_data` ha solo `action`, `ref_type`, `ref`, `commit_count`, `commit_from`, `commit_to`) né nei webhook. Si potrebbe dedurre un push non fast-forward con `GET /projects/:id/repository/merge_base?refs[]=commit_from&refs[]=commit_to` (se il merge base non è `commit_from`, la storia è stata riscritta), ma costa una chiamata per push e `commit_from` può non esistere più nel repository (404), quindi il dato non è affidabile.
- **Stub adottato nel frattempo**: nessun campo; il collettore non inventa il dato. Raccomandazione: A0/A3 mantengano la sostituzione del badge; se si vuole l'euristica, il campo deve essere `nullable` ("sconosciuto").
