import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { copy } from '@git-wrapped/copy';
import type { Member } from '@git-wrapped/contracts';
import { MemberPicker, OscarNight } from './index';
import { VARIANTS, VARIANT_NAMES } from '../cards/variants';

afterEach(cleanup);

const members = (n: number): Member[] =>
  Array.from({ length: n }, (_, i) => ({
    username: `utente${i}`,
    displayName: `Persona Numero${i}`,
  }));

describe('MemberPicker', () => {
  it('elenca i membri e chiama onPick', () => {
    const onPick = vi.fn();
    render(
      <MemberPicker
        members={members(3)}
        year={2026}
        demoMode={false}
        onPick={onPick}
        onOpenOscar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Persona Numero1'));
    expect(onPick).toHaveBeenCalledWith({ username: 'utente1', displayName: 'Persona Numero1' });
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('mostra il banner demo', () => {
    render(
      <MemberPicker
        members={members(2)}
        year={2026}
        demoMode
        onPick={() => {}}
        onOpenOscar={() => {}}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe(copy.ui.demo_mode_banner);
  });

  it('con più di 12 membri compare la ricerca che filtra', () => {
    render(
      <MemberPicker
        members={members(20)}
        year={2026}
        demoMode={false}
        onPick={() => {}}
        onOpenOscar={() => {}}
      />,
    );
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'numero19' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('il bottone Oscar chiama onOpenOscar', () => {
    const onOpen = vi.fn();
    render(
      <MemberPicker
        members={members(1)}
        year={2026}
        demoMode={false}
        onPick={() => {}}
        onOpenOscar={onOpen}
      />,
    );
    fireEvent.click(screen.getByText(new RegExp(copy.ui.oscar_cta.replace(/[[\]]/g, '\\$&'))));
    expect(onOpen).toHaveBeenCalled();
  });

  it('regge nessun membro e nomi lunghissimi', () => {
    const long: Member[] = [{ username: 'x'.repeat(200), displayName: 'Y'.repeat(300) }];
    const { unmount } = render(
      <MemberPicker
        members={[]}
        year={2026}
        demoMode={false}
        onPick={() => {}}
        onOpenOscar={() => {}}
      />,
    );
    unmount();
    render(
      <MemberPicker members={long} year={2026} demoMode onPick={() => {}} onOpenOscar={() => {}} />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });
});

describe('OscarNight', () => {
  it.each(VARIANT_NAMES)('si renderizza (%s)', (name) => {
    const awards = VARIANTS[name].awards;
    render(<OscarNight awards={awards} onBack={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(copy.ui.oscar_title);
    expect(screen.queryAllByTestId('export-button')).toHaveLength(awards.awards.length);
  });

  it('ogni premio ha un’etichetta accessibile con i vincitori', () => {
    render(<OscarNight awards={VARIANTS.example.awards} />);
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(VARIANTS.example.awards.awards.length);
    expect(articles[0]?.getAttribute('aria-label')).toContain('Giulia Ferri');
  });
});
