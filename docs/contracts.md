# Contratti — `contracts-v3`

I contratti vivono in `packages/contracts` (schemi `zod` + tipi TypeScript inferiti) e sono
**congelati al tag `contracts-v3`** (`CONTRACTS_VERSION = 3`). Le richieste di cambiamento vanno
in [`contract-requests.md`](./contract-requests.md).

**Novità di `contracts-v3`** rispetto a `contracts-v2` (non retrocompatibili): l'app mostra solo il
wrapped del proprietario del token GitLab, che deve essere un Personal Access Token.

- Nuova rotta `GET /api/me` (`meResponseSchema`, uguale a `WrappedStats`), `apiPaths.me(year?)`.
- Rimosse le rotte `GET /api/members`, `GET /api/wrapped/:username` e `GET /api/team`, con
  `membersResponseSchema`, `wrappedResponseSchema`, `teamResponseSchema` e `wrappedParamsSchema`.
- Rimossi i premi di team (notte degli Oscar): `team.ts` (`TeamAwards`), `AwardId`/`AWARD_IDS` e la
  sezione `awards` del catalogo testi.
- Nuovi codici di errore `unauthorized` (401) e `bot_token` (403).
- `UiKey`: rimosse `pick_member`, `pick_member_hint`, `search_members`, `oscar_title`, `oscar_cta`,
  `error_not_found`; aggiunte `error_token_hint` e `story_end`.

**Novità di `contracts-v2`** rispetto a `contracts-v1` (tutte additive, decise da A11 in Fase 2):

- `WrappedStats.pipelines.recoveries`: pipeline verdi subito dopo una rossa (stesso progetto e ref);
  assente in un payload v1 → `0`. Abilitava il premio `pipeline_phoenix` (rimosso in v3).
- `EpicMomentKind` `earliest_morning_commit`: minuti dalla mezzanotte del commit più presto tra
  05:00 e 11:59. Il premio `first_light` (rimosso in v3) passava dalla precisione all'ora a quella al minuto.
- `UiKey`: `search_members` e le etichette `label_*` dei numeri nelle card.

```ts
import { wrappedStatsSchema, type WrappedStats } from '@git-wrapped/contracts';
import { exampleWrappedStats } from '@git-wrapped/contracts/examples';
```

## Mappa dei moduli

| File          | Contenuto                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `common.ts`   | Primitive: `isoDateTime`, `isoDate`, istogrammi (24 ore, 7 giorni con 0 = lunedì, 12 mesi), `Member` |
| `catalog.ts`  | Cataloghi chiusi: `BadgeId`, `PersonalityId`, `PersonalityDimension`, `CardId`, `EpicMomentKind`     |
| `raw.ts`      | `RawActivity`: dati grezzi GitLab di una persona per un anno                                         |
| `stats.ts`    | `WrappedStats`: statistiche annuali di una persona                                                   |
| `calendar.ts` | `CalendarEvent` (normalizzato, senza testi) e `CalendarStats`                                        |
| `copy.ts`     | Struttura del catalogo testi `CopyCatalog`, chiavi `UiKey`, segnaposto ammessi per sezione           |
| `api.ts`      | Rotte, schemi di risposta, `ApiError`, helper `apiPaths`                                             |
| `examples.ts` | Un esempio valido per ogni tipo (export `@git-wrapped/contracts/examples`)                           |

## Convenzioni

- **Date**: ISO 8601 con offset. Ore, giorni e badge si calcolano nel fuso `TZ` (default `Europe/Rome`).
- **Privacy nei dati grezzi**: di note e descrizioni esiste solo la lunghezza (`bodyLength`,
  `descriptionLength`). I messaggi di commit sono inclusi perché già pubblici nel team.
  Dei diff si contano solo le righe con TODO/FIXME/XXX (`todosAdded`, `todosRemoved`).
- **Force push**: GitLab non li distingue in modo affidabile negli eventi, quindi non esistono
  nei contratti e il badge "Revisionista storico" non è nel catalogo.
- **Dati mancanti**: se GitLab non fornisce un dato, il campo è `null` o il badge viene
  omesso. Mai inventare.
- **Personalità**: sempre presente, mai "nessuna". Punteggi per dimensione in `[0, 1]`.
- **Oroscopo**: `horoscopeSeed` è un uint32 da hash(username + anno); `packages/copy` sceglie una
  frase da `openings`, `middles` e `closings`.
- **Testi**: `copyCatalogSchema` usa `z.record` su enum, quindi è esaustivo: manca una chiave → errore.
  Segnaposto `{nome}` ammessi per sezione in `COPY_PLACEHOLDERS`.

## Catalogo badge

| `BadgeId`           | Nome                  |
| ------------------- | --------------------- |
| `night_owl`         | Gufo notturno         |
| `early_bird`        | Allodola              |
| `main_breaker`      | Distruttore di main   |
| `blind_approver`    | Approvatore cieco     |
| `novelist`          | Romanziere            |
| `silent_monk`       | Monaco silenzioso     |
| `ghost_mr`          | MR fantasma           |
| `lives_dangerously` | Vive pericolosamente  |
| `marie_kondo`       | Marie Kondo           |
| `todo_collector`    | Collezionista di TODO |
| `necromancer`       | Necromante            |
| `polyglot`          | Poliglotta            |
| `emoji_overlord`    | Re delle reazioni     |

Le soglie sono di A3 e vanno documentate in `packages/stats/BADGES.md`.

## Personalità

`architect`, `firefighter`, `gardener`, `diplomat`, `sprinter`, `philosopher`, `night_creature`,
`metronome`, calcolate sulle dimensioni `nocturnality`, `collaboration`, `cleanup`, `changeSize`,
`cadence`, `verbosity`, `regularity`, `urgency`.

## API HTTP

| Rotta               | Risposta                      | Note                                                       |
| ------------------- | ----------------------------- | ---------------------------------------------------------- |
| `GET /api/health`   | `HealthResponse`              | Usata dall'healthcheck del container                       |
| `GET /api/me?year=` | `MeResponse` (`WrappedStats`) | Wrapped del proprietario del token (`GET /user` su GitLab) |

Non esiste una rotta per leggere le statistiche di altre persone. In modalità demo `GET /api/me`
restituisce un membro fisso del team finto.

Errori: corpo `ApiError` con un `message` in italiano senza dati personali e `code` tra:

| `code`           | Stato | Quando                                                                  |
| ---------------- | ----- | ----------------------------------------------------------------------- |
| `bad_request`    | 400   | Query non valida (es. `year` fuori intervallo)                          |
| `unauthorized`   | 401   | Token mancante, non valido, scaduto o revocato                          |
| `bot_token`      | 403   | Il token appartiene a un bot (Group/Project Access Token): serve un PAT |
| `not_found`      | 404   | L'utente del token non ha attività leggibili nei gruppi letti           |
| `rate_limited`   | 429   | GitLab limita le richieste                                              |
| `upstream_error` | 502   | GitLab non risponde come previsto                                       |
| `internal`       | 500   | Errore imprevisto del server                                            |

## Interfacce interne congelate

Oltre al pacchetto dei contratti, A0 congela tre confini tra agenti:

| File                                                                  | Confine                                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/api/src/source.ts`                                              | `ActivitySource` tra collettore (A1) e server (A2), con `currentUser()` da `contracts-v3` |
| `apps/web/src/shared/types.ts`                                        | `StoryCard`, props del player (A6), delle card (A7), del calendario (A8)                  |
| `packages/stats/src/index.ts`, `packages/stats/src/calendar/index.ts` | Firme di `computeWrappedStats`, `horoscopeSeed`, `computeCalendarStats`                   |

## Esempi

Generati da `packages/contracts/src/examples.ts` con `pnpm docs:contracts`.

<!-- esempi generati: non modificare a mano sotto questa riga -->

### RawActivity

```json
{
  "schemaVersion": 1,
  "member": {
    "username": "giulia.ferri",
    "displayName": "Giulia Ferri"
  },
  "year": 2026,
  "projects": [
    {
      "id": 101,
      "path": "acme/piattaforma/backend",
      "defaultBranch": "main",
      "languages": {
        "TypeScript": 82.5,
        "Shell": 10.1,
        "Dockerfile": 7.4
      },
      "lastActivityBeforeYearAt": "2025-12-19T17:02:11+01:00"
    }
  ],
  "commits": [
    {
      "sha": "3f9c2a1e7b4d",
      "authoredAt": "2026-03-14T23:41:07+01:00",
      "projectPath": "acme/piattaforma/backend",
      "files": ["src/server.ts", "src/routes/orders.ts"],
      "additions": 42,
      "deletions": 7,
      "message": "fix: gestisce gli ordini vuoti senza esplodere",
      "isMerge": false,
      "todosAdded": 1,
      "todosRemoved": 0
    }
  ],
  "mergeRequests": [
    {
      "iid": 57,
      "projectPath": "acme/piattaforma/backend",
      "createdAt": "2026-03-14T10:00:00+01:00",
      "updatedAt": "2026-03-15T09:30:00+01:00",
      "mergedAt": "2026-03-15T09:30:00+01:00",
      "closedAt": null,
      "firstApprovedAt": "2026-03-14T16:12:00+01:00",
      "state": "merged",
      "isDraft": false,
      "targetBranch": "main",
      "changedLines": 49,
      "descriptionLength": 312,
      "reviewers": ["marco.vitale"],
      "approvedBy": ["marco.vitale"],
      "notesCount": 4
    }
  ],
  "approvalsGiven": [
    {
      "projectPath": "acme/piattaforma/frontend",
      "mrIid": 88,
      "mrAuthor": "marco.vitale",
      "mrCreatedAt": "2026-05-02T11:00:00+02:00",
      "approvedAt": "2026-05-02T11:03:00+02:00",
      "mrChangedLines": 1240
    }
  ],
  "pipelines": [
    {
      "id": 90210,
      "projectPath": "acme/piattaforma/backend",
      "status": "failed",
      "ref": "main",
      "isDefaultBranch": true,
      "createdAt": "2026-03-14T23:45:00+01:00",
      "durationSeconds": 412,
      "author": "giulia.ferri"
    }
  ],
  "deployments": [
    {
      "projectPath": "acme/piattaforma/backend",
      "environment": "production",
      "status": "success",
      "createdAt": "2026-06-12T17:30:00+02:00"
    }
  ],
  "notes": [
    {
      "createdAt": "2026-05-02T11:02:00+02:00",
      "noteableType": "MergeRequest",
      "bodyLength": 18,
      "projectPath": "acme/piattaforma/frontend",
      "counterpart": "marco.vitale"
    }
  ],
  "emojiGiven": [
    {
      "name": "tada",
      "awardedAt": "2026-05-02T11:03:30+02:00",
      "awardableType": "MergeRequest",
      "counterpart": "marco.vitale"
    }
  ],
  "emojiReceived": [
    {
      "name": "rocket",
      "awardedAt": "2026-03-15T09:31:00+01:00",
      "awardableType": "MergeRequest",
      "from": "marco.vitale"
    }
  ],
  "issueEvents": [
    {
      "action": "reopened",
      "at": "2026-09-01T09:00:00+02:00",
      "projectPath": "acme/piattaforma/backend",
      "issueIid": 12,
      "issueCreatedAt": "2024-02-10T10:00:00+01:00",
      "previouslyClosedAt": "2024-03-01T10:00:00+01:00"
    }
  ],
  "pushEvents": [
    {
      "at": "2026-03-14T23:41:30+01:00",
      "projectPath": "acme/piattaforma/backend",
      "action": "pushed",
      "refType": "branch",
      "ref": "main",
      "isDefaultBranch": true,
      "commitCount": 1
    }
  ]
}
```

### WrappedStats (`GET /api/me`)

```json
{
  "schemaVersion": 1,
  "member": {
    "username": "giulia.ferri",
    "displayName": "Giulia Ferri"
  },
  "year": 2026,
  "timezone": "Europe/Rome",
  "totals": {
    "commits": 612,
    "linesAdded": 48210,
    "linesDeleted": 39877,
    "mergeRequestsOpened": 74,
    "mergeRequestsMerged": 69,
    "approvalsGiven": 131,
    "notesWritten": 402,
    "pipelines": 980,
    "pipelinesFailed": 143,
    "deployments": 37,
    "issuesOpened": 22,
    "issuesClosed": 31,
    "emojiGiven": 288,
    "emojiReceived": 197,
    "projectsTouched": 6,
    "activeDays": 201
  },
  "topProjects": [
    {
      "projectPath": "acme/piattaforma/backend",
      "commits": 401,
      "share": 0.655
    },
    {
      "projectPath": "acme/piattaforma/frontend",
      "commits": 150,
      "share": 0.245
    }
  ],
  "topFiles": [
    {
      "path": "src/routes/orders.ts",
      "projectPath": "acme/piattaforma/backend",
      "touches": 77
    }
  ],
  "languages": [
    {
      "name": "TypeScript",
      "share": 0.78
    },
    {
      "name": "Shell",
      "share": 0.12
    },
    {
      "name": "Dockerfile",
      "share": 0.1
    }
  ],
  "hours": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0, 0, 98, 0, 0, 0, 0, 0, 0, 0, 41],
  "weekdays": [130, 141, 120, 118, 92, 8, 3],
  "months": [40, 51, 66, 58, 49, 60, 71, 12, 55, 63, 50, 37],
  "peakHour": 10,
  "peakWeekday": 1,
  "streak": {
    "longestDays": 17,
    "from": "2026-02-02",
    "to": "2026-02-18"
  },
  "duet": {
    "partner": {
      "username": "marco.vitale",
      "displayName": "Marco Vitale"
    },
    "interactions": 214,
    "via": {
      "approvals": 88,
      "reviews": 61,
      "notes": 40,
      "emoji": 25
    }
  },
  "commitMessages": {
    "averageLength": 38.4,
    "shortest": "ops",
    "longestLength": 612,
    "topWords": [
      {
        "word": "fix",
        "count": 120
      },
      {
        "word": "ordini",
        "count": 44
      }
    ],
    "fixCount": 120,
    "wipCount": 9,
    "emojiCount": 14
  },
  "pipelines": {
    "total": 980,
    "failed": 143,
    "successRate": 0.854,
    "longestFailStreak": 6,
    "recoveries": 41,
    "graveyard": [
      {
        "projectPath": "acme/piattaforma/backend",
        "ref": "main",
        "failedAt": "2026-03-14T23:45:00+01:00"
      }
    ]
  },
  "ghostMrs": {
    "count": 3,
    "oldestDays": 142
  },
  "fridayDeploys": {
    "count": 5,
    "latestAt": "2026-06-12T17:30:00+02:00"
  },
  "emoji": {
    "topGiven": [
      {
        "name": "tada",
        "count": 90
      },
      {
        "name": "thumbsup",
        "count": 80
      }
    ],
    "topReceived": [
      {
        "name": "rocket",
        "count": 51
      }
    ]
  },
  "epicMoments": [
    {
      "kind": "latest_night_commit",
      "at": "2026-03-15T03:12:00+01:00",
      "value": 192,
      "projectPath": "acme/piattaforma/backend"
    },
    {
      "kind": "earliest_morning_commit",
      "at": "2026-06-03T05:47:00+02:00",
      "value": 347,
      "projectPath": "acme/piattaforma/frontend"
    }
  ],
  "badges": [
    {
      "id": "night_owl",
      "value": 0.18
    },
    {
      "id": "blind_approver",
      "value": 3
    }
  ],
  "personality": {
    "id": "firefighter",
    "scores": {
      "nocturnality": 0.6,
      "collaboration": 0.7,
      "cleanup": 0.4,
      "changeSize": 0.3,
      "cadence": 0.8,
      "verbosity": 0.2,
      "regularity": 0.4,
      "urgency": 0.9
    }
  },
  "horoscopeSeed": 2840193771
}
```

### CalendarEvent

```json
{
  "start": "2026-04-17T15:00:00+02:00",
  "end": "2026-04-17T16:30:00+02:00",
  "isAllDay": false,
  "attendeeCount": 12,
  "isTeamsCall": true,
  "isRecurring": false,
  "declined": false
}
```

### CalendarStats

```json
{
  "schemaVersion": 1,
  "year": 2026,
  "meetings": 412,
  "meetingHours": 377.5,
  "declinedInvites": 58,
  "longestMeeting": {
    "minutes": 240,
    "date": "2026-01-20"
  },
  "mostCrowded": {
    "attendees": 86,
    "date": "2026-12-18"
  },
  "longestBackToBack": {
    "meetings": 6,
    "date": "2026-04-21"
  },
  "fridayAfternoonMeetings": 27,
  "teamsCallShare": 0.71,
  "recurringShare": 0.55,
  "hours": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 140, 0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 0, 0, 0],
  "weekdays": [95, 102, 88, 80, 47, 0, 0],
  "meetingsPerCommit": 0.67
}
```

### HealthResponse (`GET /api/health`)

```json
{
  "status": "ok",
  "demoMode": true,
  "year": 2026,
  "contractsVersion": 3
}
```

### ApiError (risposte 4xx/5xx)

```json
{
  "error": {
    "code": "bot_token",
    "message": "Questo token appartiene a un bot: serve un Personal Access Token personale."
  }
}
```
