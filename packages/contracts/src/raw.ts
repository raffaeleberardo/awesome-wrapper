import { z } from 'zod';
import { count, isoDateTime, memberSchema, projectPath, username, year } from './common';

/**
 * Dati grezzi di un utente per un anno, così come arrivano da GitLab.
 * Vivono solo in memoria nel container `api`. Mai il testo di note o descrizioni:
 * solo la loro lunghezza in caratteri.
 */

export const rawProjectSchema = z.object({
  id: z.number().int(),
  path: projectPath,
  defaultBranch: z.string().nullable(),
  /** Percentuali per linguaggio da `GET /projects/:id/languages`, es. `{ TypeScript: 71.2 }`. */
  languages: z.record(z.string(), z.number().min(0).max(100)),
  /** Data dell'ultima attività sul progetto prima dell'anno raccontato, se nota. Serve al Necromante. */
  lastActivityBeforeYearAt: isoDateTime.nullable(),
});
export type RawProject = z.infer<typeof rawProjectSchema>;

export const rawCommitSchema = z.object({
  sha: z.string().min(7),
  authoredAt: isoDateTime,
  projectPath,
  /** Percorsi dei file toccati (dal diff del commit). */
  files: z.array(z.string()),
  additions: count,
  deletions: count,
  /** Messaggio completo del commit (pubblico nel team). */
  message: z.string(),
  isMerge: z.boolean(),
  /** Righe aggiunte nel diff che contengono TODO/FIXME/XXX. Solo il conteggio. */
  todosAdded: count,
  /** Righe rimosse nel diff che contengono TODO/FIXME/XXX. Solo il conteggio. */
  todosRemoved: count,
});
export type RawCommit = z.infer<typeof rawCommitSchema>;

export const mergeRequestStateSchema = z.enum(['opened', 'merged', 'closed', 'locked']);

export const rawMergeRequestSchema = z.object({
  iid: z.number().int(),
  projectPath,
  /** L'utente di cui si calcola il Wrapped è l'autore di questa MR. */
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  mergedAt: isoDateTime.nullable(),
  closedAt: isoDateTime.nullable(),
  firstApprovedAt: isoDateTime.nullable(),
  state: mergeRequestStateSchema,
  isDraft: z.boolean(),
  targetBranch: z.string(),
  /** Righe aggiunte + rimosse; `null` se GitLab non le fornisce (diff troppo grande). */
  changedLines: count.nullable(),
  /** Lunghezza della descrizione in caratteri. Mai il testo. */
  descriptionLength: count,
  reviewers: z.array(username),
  approvedBy: z.array(username),
  /** Note umane (non di sistema) ricevute sulla MR. */
  notesCount: count,
});
export type RawMergeRequest = z.infer<typeof rawMergeRequestSchema>;

/** Approvazione data dall'utente sulla MR di qualcun altro. */
export const rawApprovalGivenSchema = z.object({
  projectPath,
  mrIid: z.number().int(),
  mrAuthor: username,
  mrCreatedAt: isoDateTime,
  approvedAt: isoDateTime,
  mrChangedLines: count.nullable(),
});
export type RawApprovalGiven = z.infer<typeof rawApprovalGivenSchema>;

export const pipelineStatusSchema = z.enum([
  'success',
  'failed',
  'canceled',
  'skipped',
  'running',
  'pending',
  'manual',
  'other',
]);

export const rawPipelineSchema = z.object({
  id: z.number().int(),
  projectPath,
  status: pipelineStatusSchema,
  ref: z.string(),
  /** `true` se `ref` è il branch di default del progetto. */
  isDefaultBranch: z.boolean(),
  createdAt: isoDateTime,
  durationSeconds: count.nullable(),
  /** Username di chi ha avviato la pipeline (sempre l'utente stesso in `RawActivity`). */
  author: username,
});
export type RawPipeline = z.infer<typeof rawPipelineSchema>;

export const rawDeploymentSchema = z.object({
  projectPath,
  environment: z.string(),
  status: z.enum(['success', 'failed', 'canceled', 'running', 'created', 'blocked', 'other']),
  createdAt: isoDateTime,
});
export type RawDeployment = z.infer<typeof rawDeploymentSchema>;

export const noteableTypeSchema = z.enum(['MergeRequest', 'Issue', 'Commit', 'Epic', 'Other']);

/** Commento scritto dall'utente. Solo metadati: mai il testo. */
export const rawNoteSchema = z.object({
  createdAt: isoDateTime,
  noteableType: noteableTypeSchema,
  bodyLength: count,
  projectPath: projectPath.nullable(),
  /** Autore dell'oggetto commentato (MR, issue...), se noto. Serve al "duetto". */
  counterpart: username.nullable(),
});
export type RawNote = z.infer<typeof rawNoteSchema>;

export const awardableTypeSchema = z.enum(['MergeRequest', 'Issue', 'Note', 'Snippet', 'Other']);

export const rawEmojiGivenSchema = z.object({
  /** Nome dell'emoji GitLab, es. `thumbsup`, `tada`. */
  name: z.string(),
  awardedAt: isoDateTime,
  awardableType: awardableTypeSchema,
  /** Autore dell'oggetto che ha ricevuto l'emoji. */
  counterpart: username.nullable(),
});
export type RawEmojiGiven = z.infer<typeof rawEmojiGivenSchema>;

export const rawEmojiReceivedSchema = z.object({
  name: z.string(),
  awardedAt: isoDateTime,
  awardableType: awardableTypeSchema,
  /** Chi ha dato l'emoji. */
  from: username,
});
export type RawEmojiReceived = z.infer<typeof rawEmojiReceivedSchema>;

export const rawIssueEventSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened']),
  at: isoDateTime,
  projectPath,
  issueIid: z.number().int(),
  issueCreatedAt: isoDateTime,
  /** Per `reopened`: quando la issue era stata chiusa l'ultima volta prima della riapertura. */
  previouslyClosedAt: isoDateTime.nullable(),
});
export type RawIssueEvent = z.infer<typeof rawIssueEventSchema>;

/**
 * Evento di push (dagli eventi utente GitLab). Non distingue i force push:
 * GitLab non lo espone in modo affidabile negli eventi.
 */
export const rawPushEventSchema = z.object({
  at: isoDateTime,
  projectPath,
  action: z.enum(['pushed', 'created', 'deleted']),
  refType: z.enum(['branch', 'tag']),
  ref: z.string(),
  /** `true` se `ref` è il branch di default del progetto. */
  isDefaultBranch: z.boolean(),
  commitCount: count,
});
export type RawPushEvent = z.infer<typeof rawPushEventSchema>;

export const rawActivitySchema = z.object({
  schemaVersion: z.literal(1),
  member: memberSchema,
  year,
  projects: z.array(rawProjectSchema),
  commits: z.array(rawCommitSchema),
  mergeRequests: z.array(rawMergeRequestSchema),
  approvalsGiven: z.array(rawApprovalGivenSchema),
  pipelines: z.array(rawPipelineSchema),
  deployments: z.array(rawDeploymentSchema),
  notes: z.array(rawNoteSchema),
  emojiGiven: z.array(rawEmojiGivenSchema),
  emojiReceived: z.array(rawEmojiReceivedSchema),
  issueEvents: z.array(rawIssueEventSchema),
  pushEvents: z.array(rawPushEventSchema),
});
export type RawActivity = z.infer<typeof rawActivitySchema>;
