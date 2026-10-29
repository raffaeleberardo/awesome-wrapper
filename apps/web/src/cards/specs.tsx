import { useEffect, type ReactNode } from 'react';
import type { CardId, UiKey } from '@git-wrapped/contracts';
import type { CalendarStats, WrappedStats } from '@git-wrapped/contracts';
import { copy, format, horoscope } from '@git-wrapped/copy';
import type { ThemeName } from '../shared/types';
import {
  badgeValue,
  emojiGlyph,
  fmt,
  fmt1,
  fmt2,
  hourLabel,
  pct,
  shortDate,
  WEEKDAY_NAMES,
} from './format';
import { fireConfetti } from './confetti';
import {
  Bar,
  BigNumber,
  Glyph,
  Histogram,
  Line,
  Tile,
  TileGrid,
  clamp,
  displayFont,
  softSurface,
  wrapText,
} from './ui';

/**
 * Una specifica per card, nell'ordine di `CARD_IDS`. Ogni specifica dice quali dati legge, che tema usa,
 * quanto dura, quali "fatti" finiscono nell'`ariaLabel` e come si disegna il corpo.
 * Le etichette dei numeri vengono dal catalogo testi (`copy.ui.label_*`, `contracts-v2`).
 */

export interface CardContext {
  stats: WrappedStats;
  calendar: CalendarStats | null;
}

interface BodyProps {
  ctx: CardContext;
  exporting: boolean;
}

export interface CardSpec {
  id: CardId;
  theme: ThemeName;
  durationMs: number;
  /** Valore principale, per il segnaposto `{value}` dei testi della card. */
  value: (ctx: CardContext) => string | number;
  /** Tutte le informazioni mostrate, in forma testuale (per l'`ariaLabel`). */
  facts: (ctx: CardContext) => string[];
  Body: (props: BodyProps) => ReactNode;
  /** Se la card ha senso senza dati: false → mostra lo stato vuoto gentile. */
  hasData: (ctx: CardContext) => boolean;
}

const ui = copy.ui;
const uiv = (key: UiKey, value: string) => format('ui', copy.ui[key], { value });

const pick = <T,>(list: T[], seed: number): T | undefined =>
  list.length > 0 ? list[(seed >>> 0) % list.length] : undefined;

/** Stato vuoto: nessun numero inventato, solo un simbolo neutro. */
function Empty({ glyph = '∅' }: { glyph?: string }) {
  return (
    <div style={{ textAlign: 'center', opacity: 0.7 }}>
      <Glyph size={30}>{glyph}</Glyph>
    </div>
  );
}

const projectName = (p: string) => p;

function PathText({ text, size = 4.4 }: { text: string; size?: number }) {
  return (
    <div
      style={{
        ...clamp(2),
        fontSize: `${size}cqw`,
        fontWeight: 700,
        fontFamily: displayFont,
        minWidth: 0,
      }}
    >
      {text}
    </div>
  );
}

export const CARD_SPECS: CardSpec[] = [
  {
    id: 'intro',
    theme: 'electric',
    durationMs: 5000,
    value: ({ stats }) => stats.member.displayName,
    facts: ({ stats }) => [stats.member.displayName, String(stats.year)],
    hasData: () => true,
    Body: ({ ctx: { stats } }) => {
      const line = pick(copy.intro, stats.horoscopeSeed);
      return (
        <>
          <div
            style={{
              ...clamp(4),
              fontFamily: displayFont,
              fontWeight: 900,
              fontSize: '15cqw',
              lineHeight: 1,
              color: 'var(--accent)',
            }}
          >
            {stats.member.displayName}
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontWeight: 900,
              fontSize: '24cqw',
              lineHeight: 1,
              opacity: 0.95,
            }}
          >
            {stats.year}
          </div>
          {line ? (
            <Line size={5}>
              {format('intro', line, { name: stats.member.displayName, year: stats.year })}
            </Line>
          ) : null}
        </>
      );
    },
  },
  {
    id: 'key_numbers',
    theme: 'lime',
    durationMs: 7000,
    value: ({ stats }) => fmt(stats.totals.commits),
    facts: ({ stats: { totals: t } }) => [
      `${fmt(t.commits)} commit`,
      `+${fmt(t.linesAdded)} / −${fmt(t.linesDeleted)} righe`,
      `${fmt(t.mergeRequestsMerged)}/${fmt(t.mergeRequestsOpened)} MR`,
      `${fmt(t.approvalsGiven)} approvazioni`,
      `${fmt(t.notesWritten)} note`,
      `${fmt(t.pipelines)} pipeline`,
      `${fmt(t.deployments)} deploy`,
      `${fmt(t.activeDays)} giorni attivi`,
    ],
    hasData: () => true,
    Body: ({ ctx: { stats: s }, exporting }) => (
      <>
        <BigNumber value={s.totals.commits} exporting={exporting} suffix="" />
        <div style={{ fontSize: '4cqw', opacity: 0.85 }}>{ui.label_commits}</div>
        <TileGrid>
          <Tile value={`+${fmt(s.totals.linesAdded)}`} label={ui.label_lines_added} />
          <Tile value={`−${fmt(s.totals.linesDeleted)}`} label={ui.label_lines_deleted} />
          <Tile value={fmt(s.totals.mergeRequestsMerged)} label={ui.label_mrs_merged} />
          <Tile value={fmt(s.totals.approvalsGiven)} label={ui.label_approvals} />
          <Tile value={fmt(s.totals.notesWritten)} label={ui.label_notes} />
          <Tile value={fmt(s.totals.pipelines)} label={ui.label_pipelines} />
          <Tile value={fmt(s.totals.deployments)} label={ui.label_deploys} />
          <Tile value={fmt(s.totals.activeDays)} label={ui.label_active_days} />
        </TileGrid>
      </>
    ),
  },
  {
    id: 'top_projects',
    theme: 'sunset',
    durationMs: 6000,
    value: ({ stats }) => fmt(stats.totals.projectsTouched),
    facts: ({ stats }) =>
      stats.topProjects.map(
        (p) => `${projectName(p.projectPath)}: ${fmt(p.commits)} commit, ${pct(p.share)}`,
      ),
    hasData: ({ stats }) => stats.topProjects.length > 0,
    Body: ({ ctx: { stats } }) =>
      stats.topProjects.length === 0 ? (
        <Empty glyph="📦" />
      ) : (
        <>
          {stats.topProjects.map((p, i) => (
            <div key={`${p.projectPath}-${i}`} style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '3cqw', alignItems: 'baseline', minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{ fontFamily: displayFont, fontWeight: 900, fontSize: '7cqw' }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PathText text={p.projectPath} size={i === 0 ? 5.6 : 4.4} />
                </div>
              </div>
              <div style={{ fontSize: '3.6cqw', opacity: 0.85, margin: '1cqw 0' }}>
                {fmt(p.commits)} commit · {pct(p.share)}
              </div>
              <Bar ratio={p.share} />
            </div>
          ))}
        </>
      ),
  },
  {
    id: 'top_files',
    theme: 'ocean',
    durationMs: 6000,
    value: ({ stats }) => fmt(stats.topFiles[0]?.touches ?? 0),
    facts: ({ stats }) =>
      stats.topFiles.map((f) => `${f.path} (${f.projectPath}): ${fmt(f.touches)}`),
    hasData: ({ stats }) => stats.topFiles.length > 0,
    Body: ({ ctx: { stats } }) =>
      stats.topFiles.length === 0 ? (
        <Empty glyph="📄" />
      ) : (
        <>
          {stats.topFiles.map((f, i) => (
            <div
              key={`${f.path}-${i}`}
              style={{
                background: softSurface,
                borderRadius: '3cqw',
                padding: '3cqw',
                minWidth: 0,
              }}
            >
              <PathText text={f.path} size={i === 0 ? 4.8 : 3.8} />
              {i === 0 ? (
                <div style={{ ...clamp(1), fontSize: '3cqw', opacity: 0.75, margin: '1cqw 0' }}>
                  {f.projectPath}
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: displayFont,
                  fontWeight: 800,
                  fontSize: i === 0 ? '8cqw' : '4.5cqw',
                  color: 'var(--accent)',
                  ...wrapText,
                }}
              >
                ×{fmt(f.touches)}
              </div>
            </div>
          ))}
        </>
      ),
  },
  {
    id: 'languages',
    theme: 'candy',
    durationMs: 6000,
    value: ({ stats }) => stats.languages[0]?.name ?? '0',
    facts: ({ stats }) => stats.languages.map((l) => `${l.name} ${pct(l.share)}`),
    hasData: ({ stats }) => stats.languages.length > 0,
    Body: ({ ctx: { stats } }) =>
      stats.languages.length === 0 ? (
        <Empty glyph="🔤" />
      ) : (
        <>
          {stats.languages.map((l, i) => (
            <div key={`${l.name}-${i}`} style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '3cqw',
                  fontSize: i === 0 ? '6cqw' : '4.4cqw',
                  fontWeight: 700,
                  fontFamily: displayFont,
                  marginBottom: '1cqw',
                }}
              >
                <span style={{ ...clamp(1), minWidth: 0 }}>{l.name}</span>
                <span style={{ flex: '0 0 auto' }}>{pct(l.share)}</span>
              </div>
              <Bar ratio={l.share} />
            </div>
          ))}
        </>
      ),
  },
  {
    id: 'hours',
    theme: 'midnight',
    durationMs: 7000,
    value: ({ stats }) => (stats.peakHour === null ? '0' : hourLabel(stats.peakHour)),
    facts: ({ stats }) => [
      stats.peakHour === null ? '' : hourLabel(stats.peakHour),
      stats.peakWeekday === null ? '' : (WEEKDAY_NAMES[stats.peakWeekday] ?? ''),
      `ore: ${stats.hours.join(', ')}`,
      `giorni: ${stats.weekdays.map((v, i) => `${WEEKDAY_NAMES[i]} ${v}`).join(', ')}`,
    ],
    hasData: ({ stats }) => stats.hours.some((v) => v > 0),
    Body: ({ ctx: { stats } }) => (
      <>
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 900,
            fontSize: '20cqw',
            lineHeight: 1,
            color: 'var(--accent)',
          }}
        >
          {stats.peakHour === null ? '—' : hourLabel(stats.peakHour)}
        </div>
        <Histogram
          values={stats.hours}
          highlight={stats.peakHour}
          labels={(i) => String(i)}
          height={26}
        />
        <Histogram
          values={stats.weekdays}
          highlight={stats.peakWeekday}
          labels={(i) => WEEKDAY_NAMES[i] ?? ''}
          height={16}
        />
      </>
    ),
  },
  {
    id: 'streak',
    theme: 'sunset',
    durationMs: 5000,
    value: ({ stats }) => fmt(stats.streak.longestDays),
    facts: ({ stats: { streak } }) => [
      `${fmt(streak.longestDays)} giorni`,
      streak.from && streak.to ? `${shortDate(streak.from)} – ${shortDate(streak.to)}` : '',
    ],
    hasData: ({ stats }) => stats.streak.longestDays > 0,
    Body: ({ ctx: { stats }, exporting }) =>
      stats.streak.longestDays === 0 ? (
        <Empty glyph="🕯️" />
      ) : (
        <>
          <Glyph size={20}>🔥</Glyph>
          <BigNumber value={stats.streak.longestDays} exporting={exporting} max={34} />
          {stats.streak.from && stats.streak.to ? (
            <div style={{ fontSize: '5cqw', fontWeight: 700 }}>
              {shortDate(stats.streak.from)} – {shortDate(stats.streak.to)}
            </div>
          ) : null}
        </>
      ),
  },
  {
    id: 'duet',
    theme: 'candy',
    durationMs: 6000,
    value: ({ stats }) => stats.duet?.partner.displayName ?? '0',
    facts: ({ stats: { duet } }) =>
      duet
        ? [
            duet.partner.displayName,
            `${fmt(duet.interactions)} interazioni`,
            `${fmt(duet.via.approvals)} approvazioni, ${fmt(duet.via.reviews)} review, ${fmt(duet.via.notes)} note, ${fmt(duet.via.emoji)} emoji`,
          ]
        : [],
    hasData: ({ stats }) => stats.duet !== null,
    Body: ({ ctx: { stats }, exporting }) =>
      !stats.duet ? (
        <Empty glyph="🫥" />
      ) : (
        <>
          <div
            style={{
              ...clamp(3),
              fontFamily: displayFont,
              fontWeight: 900,
              fontSize: '13cqw',
              lineHeight: 1.02,
              color: 'var(--accent)',
            }}
          >
            {stats.duet.partner.displayName}
          </div>
          <BigNumber value={stats.duet.interactions} exporting={exporting} max={20} />
          <TileGrid>
            <Tile value={fmt(stats.duet.via.approvals)} label={ui.label_approvals} size={6} />
            <Tile value={fmt(stats.duet.via.reviews)} label={ui.label_reviews} size={6} />
            <Tile value={fmt(stats.duet.via.notes)} label={ui.label_notes} size={6} />
            <Tile value={fmt(stats.duet.via.emoji)} label={ui.label_emoji} size={6} />
          </TileGrid>
        </>
      ),
  },
  {
    id: 'emoji',
    theme: 'lime',
    durationMs: 6000,
    value: ({ stats }) => emojiGlyph(stats.emoji.topGiven[0]?.name ?? '') || '0',
    facts: ({ stats: { emoji, totals } }) => [
      `${fmt(totals.emojiGiven)} date, ${fmt(totals.emojiReceived)} ricevute`,
      ...emoji.topGiven.map((e) => `${e.name} ${fmt(e.count)}`),
      ...emoji.topReceived.map((e) => `ricevuta ${e.name} ${fmt(e.count)}`),
    ],
    hasData: ({ stats }) => stats.emoji.topGiven.length + stats.emoji.topReceived.length > 0,
    Body: ({ ctx: { stats } }) => {
      const top = stats.emoji.topGiven[0];
      if (!top && stats.emoji.topReceived.length === 0) return <Empty glyph="🫥" />;
      const row = (e: { name: string; count: number }, i: number) => (
        <div
          key={`${e.name}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3cqw',
            background: softSurface,
            borderRadius: '3cqw',
            padding: '2cqw 3cqw',
            minWidth: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: '8cqw',
              lineHeight: 1,
              width: '10cqw',
              overflow: 'hidden',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
          >
            {emojiGlyph(e.name)}
          </span>
          <span style={{ ...clamp(1), flex: 1, minWidth: 0, fontSize: '3.6cqw', opacity: 0.8 }}>
            {e.name}
          </span>
          <span style={{ fontFamily: displayFont, fontWeight: 800, fontSize: '5cqw' }}>
            {fmt(e.count)}
          </span>
        </div>
      );
      return (
        <>
          {top ? (
            <>
              <Glyph size={26}>{emojiGlyph(top.name)}</Glyph>
              <div style={{ fontSize: '4cqw', ...wrapText }}>
                {fmt(stats.totals.emojiGiven)} / {fmt(stats.totals.emojiReceived)}{' '}
                {ui.label_emoji_given_received}
              </div>
            </>
          ) : null}
          {stats.emoji.topGiven.slice(0, 3).map(row)}
          {stats.emoji.topReceived.slice(0, 2).map((e, i) => row(e, i + 10))}
        </>
      );
    },
  },
  {
    id: 'commit_messages',
    theme: 'electric',
    durationMs: 7000,
    value: ({ stats }) => fmt(Math.round(stats.commitMessages.averageLength)),
    facts: ({ stats: { commitMessages: m } }) => [
      `media ${fmt1(m.averageLength)} caratteri`,
      m.shortest ? `più corto: ${m.shortest}` : '',
      `più lungo: ${fmt(m.longestLength)} caratteri`,
      `fix ${fmt(m.fixCount)}, wip ${fmt(m.wipCount)}, emoji ${fmt(m.emojiCount)}`,
      ...m.topWords.map((w) => `${w.word} ${fmt(w.count)}`),
    ],
    hasData: ({ stats }) => stats.totals.commits > 0 || stats.commitMessages.longestLength > 0,
    Body: ({ ctx: { stats } }) => {
      const m = stats.commitMessages;
      if (stats.totals.commits === 0 && m.longestLength === 0) return <Empty glyph="💬" />;
      return (
        <>
          {m.shortest ? (
            <div
              style={{
                ...clamp(3),
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '7cqw',
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              “{m.shortest}”
            </div>
          ) : null}
          <TileGrid columns={2}>
            <Tile
              value={fmt(Math.round(m.averageLength))}
              label={ui.label_message_average}
              size={7}
            />
            <Tile value={fmt(m.longestLength)} label={ui.label_message_longest} size={7} />
            <Tile value={fmt(m.fixCount)} label={ui.label_message_fix} size={7} />
            <Tile value={fmt(m.wipCount)} label={ui.label_message_wip} size={7} />
            <Tile value={fmt(m.emojiCount)} label={ui.label_message_emoji} size={7} />
          </TileGrid>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2cqw', minWidth: 0 }}>
            {m.topWords.slice(0, 6).map((w, i) => (
              <span
                key={`${w.word}-${i}`}
                style={{
                  ...clamp(1),
                  maxWidth: '100%',
                  background: softSurface,
                  borderRadius: '5cqw',
                  padding: '1.2cqw 3cqw',
                  fontSize: `${Math.max(3.4, 5.5 - i * 0.4)}cqw`,
                }}
              >
                {w.word} · {fmt(w.count)}
              </span>
            ))}
          </div>
        </>
      );
    },
  },
  {
    id: 'pipeline_graveyard',
    theme: 'midnight',
    durationMs: 7000,
    value: ({ stats }) => fmt(stats.pipelines.failed),
    facts: ({ stats: { pipelines: p } }) => [
      `${fmt(p.failed)} fallite su ${fmt(p.total)} pipeline`,
      p.successRate === null ? '' : `successo ${pct(p.successRate)}`,
      `serie nera ${fmt(p.longestFailStreak)}`,
      ...p.graveyard.map((g) => `${g.projectPath} ${g.ref} ${shortDate(g.failedAt, true)}`),
    ],
    hasData: ({ stats }) => stats.pipelines.total > 0,
    Body: ({ ctx: { stats }, exporting }) => {
      const p = stats.pipelines;
      if (p.total === 0) return <Empty glyph="🪦" />;
      return (
        <>
          <BigNumber value={p.failed} exporting={exporting} max={24} />
          <div style={{ fontSize: '4cqw', opacity: 0.85 }}>
            {uiv('label_pipelines_failed_of', fmt(p.total))}
            {p.successRate === null ? '' : ` · ${pct(p.successRate)}`}
          </div>
          {p.graveyard.map((g, i) => (
            <div
              key={`${g.projectPath}-${i}`}
              style={{
                display: 'flex',
                gap: '3cqw',
                alignItems: 'center',
                background: softSurface,
                borderRadius: '3cqw',
                padding: '3cqw',
                minWidth: 0,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '9cqw' }}>
                🪦
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <PathText text={g.projectPath} size={3.8} />
                <div style={{ ...clamp(1), fontSize: '3.2cqw', opacity: 0.8 }}>
                  {g.ref} · {shortDate(g.failedAt, true)}
                </div>
              </div>
            </div>
          ))}
        </>
      );
    },
  },
  {
    id: 'ghost_mrs',
    theme: 'ocean',
    durationMs: 5000,
    value: ({ stats }) => fmt(stats.ghostMrs.count),
    facts: ({ stats: { ghostMrs } }) => [
      `${fmt(ghostMrs.count)} MR fantasma`,
      ghostMrs.oldestDays === null ? '' : `la più vecchia: ${fmt(ghostMrs.oldestDays)} giorni`,
    ],
    hasData: ({ stats }) => stats.ghostMrs.count > 0,
    Body: ({ ctx: { stats }, exporting }) =>
      stats.ghostMrs.count === 0 ? (
        <Empty glyph="✨" />
      ) : (
        <>
          <Glyph size={20}>👻</Glyph>
          <BigNumber value={stats.ghostMrs.count} exporting={exporting} max={30} />
          {stats.ghostMrs.oldestDays !== null ? (
            <div style={{ fontSize: '5cqw', fontWeight: 700, ...wrapText }}>
              {uiv('label_days', fmt(stats.ghostMrs.oldestDays))}
            </div>
          ) : null}
        </>
      ),
  },
  {
    id: 'friday_deploys',
    theme: 'sunset',
    durationMs: 5000,
    value: ({ stats }) => fmt(stats.fridayDeploys.count),
    facts: ({ stats: { fridayDeploys: f } }) => [
      `${fmt(f.count)} deploy`,
      f.latestAt ? `ultimo: ${shortDate(f.latestAt, true)}` : '',
    ],
    hasData: ({ stats }) => stats.fridayDeploys.count > 0,
    Body: ({ ctx: { stats }, exporting }) =>
      stats.fridayDeploys.count === 0 ? (
        <Empty glyph="🧘" />
      ) : (
        <>
          <Glyph size={20}>🎲</Glyph>
          <BigNumber value={stats.fridayDeploys.count} exporting={exporting} max={30} />
          {stats.fridayDeploys.latestAt ? (
            <div style={{ fontSize: '5cqw', fontWeight: 700 }}>
              {shortDate(stats.fridayDeploys.latestAt, true)}
            </div>
          ) : null}
        </>
      ),
  },
  {
    id: 'calendar',
    theme: 'lime',
    durationMs: 7000,
    value: ({ calendar }) => fmt(calendar?.meetingHours ?? 0),
    facts: ({ calendar: c }) =>
      c
        ? [
            `${fmt1(c.meetingHours)} ore in ${fmt(c.meetings)} riunioni`,
            `${fmt(c.declinedInvites)} inviti rifiutati`,
            c.longestMeeting
              ? `più lunga ${fmt(c.longestMeeting.minutes)} min, ${shortDate(c.longestMeeting.date)}`
              : '',
            c.mostCrowded
              ? `più affollata ${fmt(c.mostCrowded.attendees)} persone, ${shortDate(c.mostCrowded.date)}`
              : '',
            c.longestBackToBack
              ? `${fmt(c.longestBackToBack.meetings)} riunioni di fila, ${shortDate(c.longestBackToBack.date)}`
              : '',
            `${fmt(c.fridayAfternoonMeetings)} riunioni venerdì pomeriggio`,
            c.teamsCallShare === null ? '' : `Teams ${pct(c.teamsCallShare)}`,
            c.meetingsPerCommit === null ? '' : `${fmt2(c.meetingsPerCommit)} riunioni per commit`,
          ]
        : [],
    hasData: ({ calendar }) => calendar !== null && calendar.meetings > 0,
    Body: ({ ctx: { calendar: c }, exporting }) =>
      !c || c.meetings === 0 ? (
        <Empty glyph="📅" />
      ) : (
        <>
          <BigNumber value={Math.round(c.meetingHours)} exporting={exporting} max={26} />
          <div style={{ fontSize: '4cqw', opacity: 0.85 }}>
            {ui.label_meeting_hours} · {uiv('label_meetings', fmt(c.meetings))}
          </div>
          <TileGrid>
            <Tile value={fmt(c.declinedInvites)} label={ui.label_declined_invites} size={7} />
            <Tile
              value={c.longestMeeting ? `${fmt(c.longestMeeting.minutes)}′` : '—'}
              label={ui.label_longest_meeting}
              size={7}
            />
            <Tile
              value={c.mostCrowded ? fmt(c.mostCrowded.attendees) : '—'}
              label={ui.label_most_crowded}
              size={7}
            />
            <Tile
              value={c.longestBackToBack ? fmt(c.longestBackToBack.meetings) : '—'}
              label={ui.label_back_to_back}
              size={7}
            />
            <Tile
              value={fmt(c.fridayAfternoonMeetings)}
              label={ui.label_friday_afternoon}
              size={7}
            />
            <Tile
              value={c.teamsCallShare === null ? '—' : pct(c.teamsCallShare)}
              label={ui.label_teams_share}
              size={7}
            />
          </TileGrid>
          {c.meetingsPerCommit !== null ? (
            <div style={{ fontSize: '4.4cqw', fontWeight: 700 }}>
              {fmt2(c.meetingsPerCommit)} {ui.label_meetings_per_commit}
            </div>
          ) : null}
        </>
      ),
  },
  {
    id: 'badges',
    theme: 'electric',
    durationMs: 8000,
    value: ({ stats }) => fmt(stats.badges.length),
    facts: ({ stats }) =>
      stats.badges.map((b) => {
        const c = copy.badges[b.id];
        return `${c.title}: ${format('badges', c.description, { value: badgeValue(b.id, b.value) })}`;
      }),
    hasData: ({ stats }) => stats.badges.length > 0,
    Body: BadgesBody,
  },
  {
    id: 'personality',
    theme: 'candy',
    durationMs: 7000,
    value: ({ stats }) => copy.personalities[stats.personality.id].name,
    facts: ({ stats }) => {
      const c = copy.personalities[stats.personality.id];
      return [c.name, format('personalities', c.description, { name: stats.member.displayName })];
    },
    hasData: () => true,
    Body: ({ ctx: { stats } }) => {
      const c = copy.personalities[stats.personality.id];
      const top = Object.entries(stats.personality.scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      return (
        <>
          <Glyph size={26}>{c.emoji}</Glyph>
          <div
            style={{
              ...clamp(3),
              fontFamily: displayFont,
              fontWeight: 900,
              fontSize: '13cqw',
              lineHeight: 1,
              color: 'var(--accent)',
            }}
          >
            {c.name}
          </div>
          <Line size={4.8} lines={5}>
            {format('personalities', c.description, { name: stats.member.displayName })}
          </Line>
          {top.map(([dim, score]) => (
            <div key={dim} aria-hidden="true">
              <Bar ratio={score} />
            </div>
          ))}
        </>
      );
    },
  },
  {
    id: 'horoscope',
    theme: 'midnight',
    durationMs: 8000,
    value: () => '',
    facts: ({ stats }) => horoscope(stats.horoscopeSeed),
    hasData: () => true,
    Body: ({ ctx: { stats } }) => {
      const parts = horoscope(stats.horoscopeSeed);
      return (
        <>
          <Glyph size={16}>🔮</Glyph>
          {parts.map((p, i) => (
            <div
              key={i}
              style={{
                ...clamp(4),
                fontSize: i === 0 ? '6cqw' : '5cqw',
                fontWeight: i === 0 ? 800 : 500,
                fontFamily: i === 0 ? displayFont : undefined,
                color: i === 0 ? 'var(--accent)' : undefined,
              }}
            >
              {format('horoscope', p, { name: stats.member.displayName, year: stats.year })}
            </div>
          ))}
        </>
      );
    },
  },
  {
    id: 'summary',
    theme: 'sunset',
    durationMs: 9000,
    value: ({ stats }) => fmt(stats.totals.commits),
    facts: ({ stats }) => {
      const t = stats.totals;
      const p = copy.personalities[stats.personality.id];
      return [
        stats.member.displayName,
        String(stats.year),
        `${fmt(t.commits)} commit`,
        `${fmt(t.mergeRequestsMerged)} MR`,
        `${fmt(t.activeDays)} giorni attivi`,
        p.name,
        `${fmt(stats.badges.length)} badge`,
        stats.peakHour === null ? '' : hourLabel(stats.peakHour),
        stats.topProjects[0]?.projectPath ?? '',
      ];
    },
    hasData: () => true,
    Body: ({ ctx: { stats } }) => {
      const t = stats.totals;
      const p = copy.personalities[stats.personality.id];
      const outro = pick(copy.outro, stats.horoscopeSeed);
      return (
        <>
          <div
            style={{
              ...clamp(3),
              fontFamily: displayFont,
              fontWeight: 900,
              fontSize: '12cqw',
              lineHeight: 1,
            }}
          >
            {stats.member.displayName}
          </div>
          <TileGrid>
            <Tile value={fmt(t.commits)} label={ui.label_commits} />
            <Tile value={fmt(t.mergeRequestsMerged)} label={ui.label_mrs_merged} />
            <Tile value={fmt(t.activeDays)} label={ui.label_active_days} />
            <Tile value={fmt(stats.badges.length)} label={ui.label_badges} />
          </TileGrid>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw', minWidth: 0 }}>
            <span aria-hidden="true" style={{ fontSize: '12cqw', lineHeight: 1 }}>
              {p.emoji}
            </span>
            <span
              style={{
                ...clamp(2),
                flex: 1,
                minWidth: 0,
                fontFamily: displayFont,
                fontWeight: 800,
                fontSize: '7cqw',
                color: 'var(--accent)',
              }}
            >
              {p.name}
            </span>
          </div>
          {stats.topProjects[0] ? (
            <PathText text={stats.topProjects[0].projectPath} size={4} />
          ) : null}
          {outro ? (
            <Line size={4.4} lines={3}>
              {format('outro', outro, { name: stats.member.displayName, year: stats.year })}
            </Line>
          ) : null}
        </>
      );
    },
  },
];

function BadgesBody({ ctx: { stats }, exporting }: BodyProps) {
  const badges = stats.badges;
  useEffect(() => {
    if (!exporting && badges.length > 0) fireConfetti();
  }, [exporting, badges.length]);
  if (badges.length === 0) return <Empty glyph="🏅" />;
  // Una sola card con tutti i badge: pochi badge in grande con descrizione, tanti in forma compatta.
  const detailed = badges.length <= 3;
  return (
    <>
      <BigNumber value={badges.length} exporting={exporting} max={20} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: detailed ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: '2.5cqw',
        }}
      >
        {badges.map((b) => {
          const c = copy.badges[b.id];
          return (
            <div
              key={b.id}
              style={{
                background: softSurface,
                borderRadius: '3cqw',
                padding: detailed ? '3.5cqw' : '2.5cqw 3cqw',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  ...clamp(2),
                  fontFamily: displayFont,
                  fontWeight: 800,
                  fontSize: detailed ? '6cqw' : '3.8cqw',
                  color: 'var(--accent)',
                }}
              >
                <span aria-hidden="true">★ </span>
                {c.title}
              </div>
              {detailed ? (
                <div style={{ ...clamp(3), fontSize: '3.8cqw', marginTop: '1cqw', opacity: 0.9 }}>
                  {format('badges', c.description, { value: badgeValue(b.id, b.value) })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
