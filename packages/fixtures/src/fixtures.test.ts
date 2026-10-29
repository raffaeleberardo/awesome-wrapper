import { describe, expect, it } from 'vitest';
import { memberSchema, rawActivitySchema } from '@git-wrapped/contracts';
import { DEMO_YEAR, demoActivities, demoMembers, sampleIcs } from './index';

const ISO_WITH_OFFSET = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/g;

/** Ultima domenica del mese (1-based) come stringa `YYYY-MM-DDT03:00:00` (ora locale dopo lo switch). */
function lastSundayAt3(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const day = last.getUTCDate() - last.getUTCDay();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00`;
}

/** Offset di Roma atteso per un orario locale `YYYY-MM-DDTHH:mm:ss` (regola UE: ora legale tra fine marzo e fine ottobre). */
function expectedRomeOffset(local: string): string {
  const year = Number(local.slice(0, 4));
  const summer = local >= lastSundayAt3(year, 3) && local < lastSundayAt3(year, 10);
  return summer ? '+02:00' : '+01:00';
}

describe('membri del team demo', () => {
  it('sono 8, validi secondo memberSchema e con username unici', () => {
    expect(demoMembers).toHaveLength(8);
    for (const member of demoMembers) {
      expect(memberSchema.parse(member)).toEqual(member);
    }
    expect(new Set(demoMembers.map((m) => m.username)).size).toBe(8);
  });

  it('usano solo email e nomi inventati: nessun dominio diverso da example.com nel calendario', () => {
    const emails = sampleIcs.match(/mailto:[^\r\n]+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) {
      expect(email.endsWith('@example.com')).toBe(true);
    }
  });
});

describe('attività grezze', () => {
  it('ogni username di activities è in members, e viceversa', () => {
    const usernames = demoMembers.map((m) => m.username).sort();
    expect(Object.keys(demoActivities).sort()).toEqual(usernames);
  });

  it('ogni attività passa rawActivitySchema e corrisponde al proprio membro e anno', () => {
    for (const member of demoMembers) {
      const activity = demoActivities[member.username];
      expect(activity, member.username).toBeDefined();
      const parsed = rawActivitySchema.parse(activity);
      expect(parsed.member).toEqual(member);
      expect(parsed.year).toBe(DEMO_YEAR);
    }
  });

  it('ogni timestamp ha l offset corretto per Europe/Rome (ora legale 2026)', () => {
    let checked = 0;
    for (const member of demoMembers) {
      const json = JSON.stringify(demoActivities[member.username]);
      for (const iso of json.match(ISO_WITH_OFFSET) ?? []) {
        expect(iso.slice(19), iso).toBe(expectedRomeOffset(iso.slice(0, 19)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it('ogni persona ha attività in più tipi di evento', () => {
    for (const member of demoMembers) {
      const a = demoActivities[member.username];
      expect(a?.commits.length, member.username).toBeGreaterThanOrEqual(100);
      expect(a?.mergeRequests.length, member.username).toBeGreaterThan(0);
      expect(a?.pipelines.length, member.username).toBeGreaterThan(0);
      expect(a?.deployments.length, member.username).toBeGreaterThan(0);
      expect(a?.pushEvents.length, member.username).toBeGreaterThan(0);
    }
  });

  it('le interazioni sono coerenti tra membri del team', () => {
    const usernames = new Set(demoMembers.map((m) => m.username));
    for (const member of demoMembers) {
      const a = demoActivities[member.username];
      for (const approval of a?.approvalsGiven ?? []) {
        expect(usernames.has(approval.mrAuthor)).toBe(true);
        expect(approval.mrAuthor).not.toBe(member.username);
      }
      for (const emoji of a?.emojiGiven ?? []) {
        if (emoji.counterpart !== null) expect(usernames.has(emoji.counterpart)).toBe(true);
      }
      for (const emoji of a?.emojiReceived ?? []) {
        expect(usernames.has(emoji.from)).toBe(true);
      }
    }
  });
});
