import { useMemo, useState } from 'react';
import { copy } from '@git-wrapped/copy';
import type { MemberPickerProps, OscarNightProps } from '../shared/types';
import { THEMES } from '../theme';
import { PngExportButton } from '../cards/export';
import { fmt, hashString, initials } from '../cards/format';
import { AwardCard, awardAriaLabel, CARPET_BACKGROUND, GOLD } from './AwardCard';

/** Scelta del membro e Notte degli Oscar (A7). */

const ACCENTS = Object.values(THEMES).map((t) => t.background);
const SEARCH_THRESHOLD = 12;

const display = 'var(--font-display, system-ui, sans-serif)';

export function MemberPicker({ members, year, demoMode, onPick, onOpenOscar }: MemberPickerProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q),
    );
  }, [members, query]);

  return (
    <main
      style={{
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        padding: '24px 16px 48px',
        background: 'linear-gradient(160deg, #3b1cf5 0%, #ff3d9a 100%)',
        color: '#fff',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 20 }}>
        {demoMode ? (
          <div
            role="status"
            style={{
              background: '#c6ff3d',
              color: '#111',
              borderRadius: 12,
              padding: '8px 14px',
              fontWeight: 700,
              overflowWrap: 'anywhere',
            }}
          >
            {copy.ui.demo_mode_banner}
          </div>
        ) : null}
        <header>
          <div
            aria-hidden="true"
            style={{
              fontFamily: display,
              fontWeight: 900,
              fontSize: 'clamp(64px, 22vw, 120px)',
              lineHeight: 0.9,
              color: '#c6ff3d',
            }}
          >
            {year}
          </div>
          <h1
            style={{
              margin: '8px 0 4px',
              fontFamily: display,
              fontWeight: 900,
              fontSize: 'clamp(28px, 8vw, 44px)',
              lineHeight: 1.05,
              overflowWrap: 'anywhere',
            }}
          >
            {copy.ui.app_title}
          </h1>
          <p style={{ margin: 0, opacity: 0.9, overflowWrap: 'anywhere' }}>{copy.ui.app_tagline}</p>
        </header>

        <p style={{ margin: 0, fontWeight: 700, fontSize: 18, overflowWrap: 'anywhere' }}>
          {copy.ui.pick_member}
          <span style={{ display: 'block', fontWeight: 400, fontSize: 14, opacity: 0.85 }}>
            {copy.ui.pick_member_hint}
          </span>
        </p>

        {members.length > SEARCH_THRESHOLD ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={copy.ui.search_members}
            placeholder="🔍"
            style={{
              font: 'inherit',
              padding: '10px 14px',
              borderRadius: 999,
              border: 0,
              background: 'rgba(255,255,255,0.95)',
              color: '#111',
            }}
          />
        ) : null}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {filtered.map((m) => {
            const color = ACCENTS[hashString(m.username) % ACCENTS.length] ?? '#3b1cf5';
            return (
              <li key={m.username}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '10px 14px',
                    borderRadius: 18,
                    border: 0,
                    background: 'rgba(255,255,255,0.16)',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 auto',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: color,
                      border: '3px solid #fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: display,
                      fontWeight: 800,
                    }}
                  >
                    {initials(m.displayName)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {m.displayName}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13,
                        opacity: 0.75,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      @{m.username}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onOpenOscar}
          style={{
            font: 'inherit',
            fontWeight: 800,
            padding: '14px 20px',
            borderRadius: 999,
            border: 0,
            cursor: 'pointer',
            background: GOLD,
            color: '#2a0710',
          }}
        >
          🏆 {copy.ui.oscar_cta}
        </button>
      </div>
    </main>
  );
}

export function OscarNight({ awards, onBack }: OscarNightProps) {
  const { teamTotals: tt } = awards;
  return (
    <main
      style={{
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        padding: '24px 16px 48px',
        background: CARPET_BACKGROUND,
        color: '#fff',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 24 }}>
        <header style={{ textAlign: 'center' }}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              style={{
                font: 'inherit',
                padding: '6px 14px',
                borderRadius: 999,
                border: `1px solid ${GOLD}`,
                background: 'transparent',
                color: GOLD,
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              {copy.ui.close}
            </button>
          ) : null}
          <h1
            style={{
              margin: 0,
              fontFamily: display,
              fontWeight: 900,
              fontSize: 'clamp(32px, 8vw, 64px)',
              color: GOLD,
              overflowWrap: 'anywhere',
            }}
          >
            {copy.ui.oscar_title}
          </h1>
          <p aria-hidden="true" style={{ margin: '4px 0 0', fontSize: 24, letterSpacing: 6 }}>
            ✦ {awards.year} ✦
          </p>
        </header>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
          }}
          aria-label={`${fmt(awards.teamSize)} · ${fmt(tt.commits)} ${copy.ui.label_commits} · ${fmt(tt.mergeRequestsMerged)} ${copy.ui.label_mrs_merged} · ${fmt(tt.pipelines)} ${copy.ui.label_pipelines} · ${fmt(tt.emojiGiven)} ${copy.ui.label_emoji}`}
        >
          {[
            [fmt(awards.teamSize), '👥'],
            [fmt(tt.commits), copy.ui.label_commits],
            [fmt(tt.mergeRequestsMerged), copy.ui.label_mrs_merged],
            [fmt(tt.pipelines), copy.ui.label_pipelines],
            [fmt(tt.emojiGiven), copy.ui.label_emoji],
          ].map(([v, l]) => (
            <li
              key={l}
              style={{
                border: '1px solid rgba(245,196,81,0.5)',
                borderRadius: 999,
                padding: '4px 12px',
                overflowWrap: 'anywhere',
              }}
            >
              <b>{v}</b> {l}
            </li>
          ))}
        </ul>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 24,
            justifyItems: 'center',
          }}
        >
          {awards.awards.map((award) => (
            <li
              key={award.id}
              style={{
                width: '100%',
                maxWidth: 320,
                display: 'grid',
                gap: 10,
                justifyItems: 'center',
              }}
            >
              <article
                aria-label={awardAriaLabel(award)}
                style={{
                  width: '100%',
                  aspectRatio: '9 / 16',
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: `2px solid ${GOLD}`,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <AwardCard award={award} />
              </article>
              <PngExportButton
                theme="midnight"
                fileName={`git-wrapped-${awards.year}-award-${award.id}`}
                render={() => <AwardCard award={award} exporting />}
                label={copy.ui.download_png}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
