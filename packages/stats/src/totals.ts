import type { Totals } from '@git-wrapped/contracts';
import { parseInstant } from './internal/time';
import type { ActivityContext } from './internal/context';

/**
 * Totali dell'anno. Le righe aggiunte/cancellate escludono i commit di merge,
 * che ripeterebbero righe già contate nei commit originali.
 */
export function computeTotals(ctx: ActivityContext): Totals {
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const { item } of ctx.authoredCommits) {
    linesAdded += item.additions;
    linesDeleted += item.deletions;
  }

  const mergedInYear = ctx.raw.mergeRequests.filter((mr) => {
    const t = mr.mergedAt === null ? null : parseInstant(mr.mergedAt);
    return t !== null && t >= ctx.yearStart && t < ctx.yearEnd;
  }).length;

  const projects = new Set<string>();
  const addProject = (p: string | null) => {
    if (p) projects.add(p);
  };
  ctx.commits.forEach((c) => addProject(c.item.projectPath));
  ctx.mergeRequests.forEach((m) => addProject(m.item.projectPath));
  ctx.approvalsGiven.forEach((a) => addProject(a.item.projectPath));
  ctx.pipelines.forEach((p) => addProject(p.item.projectPath));
  ctx.deployments.forEach((d) => addProject(d.item.projectPath));
  ctx.notes.forEach((n) => addProject(n.item.projectPath));
  ctx.issueEvents.forEach((e) => addProject(e.item.projectPath));
  ctx.pushEvents.forEach((e) => addProject(e.item.projectPath));

  // Giorni attivi: commit, MR aperte, note e approvazioni (come da contratto).
  const days = new Set<string>();
  for (const list of [ctx.commits, ctx.mergeRequests, ctx.notes, ctx.approvalsGiven]) {
    for (const { at } of list) days.add(at.dateKey);
  }

  return {
    commits: ctx.commits.length,
    linesAdded,
    linesDeleted,
    mergeRequestsOpened: ctx.mergeRequests.length,
    mergeRequestsMerged: mergedInYear,
    approvalsGiven: ctx.approvalsGiven.length,
    notesWritten: ctx.notes.length,
    pipelines: ctx.pipelines.length,
    pipelinesFailed: ctx.pipelines.filter((p) => p.item.status === 'failed').length,
    deployments: ctx.deployments.length,
    issuesOpened: ctx.issueEvents.filter((e) => e.item.action === 'opened').length,
    issuesClosed: ctx.issueEvents.filter((e) => e.item.action === 'closed').length,
    emojiGiven: ctx.emojiGiven.length,
    emojiReceived: ctx.emojiReceived.length,
    projectsTouched: projects.size,
    activeDays: days.size,
  };
}
