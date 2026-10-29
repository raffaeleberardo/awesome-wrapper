import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { exampleWrappedStats } from '@git-wrapped/contracts/examples';
import { copy } from '@git-wrapped/copy';
import { App } from './App';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const health = {
  status: 'ok',
  demoMode: true,
  year: exampleWrappedStats.year,
  contractsVersion: 4,
  configured: true,
};

function mockApi(me: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url.startsWith('/api/health') ? json(200, health) : me.clone()),
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('App', () => {
  it('apre subito il percorso dell’utente del token, con il banner demo', async () => {
    mockApi(json(200, exampleWrappedStats));
    render(<App />);
    expect(await screen.findByTestId('calendar-privacy-note')).toBeTruthy();
    expect(screen.getByText(copy.ui.demo_mode_banner)).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/me', expect.anything());
  });

  it.each(['unauthorized', 'bot_token'])(
    'errore %s: messaggio del server e guida al token, senza riprova',
    async (code) => {
      mockApi(json(code === 'unauthorized' ? 401 : 403, { error: { code, message: 'Token KO' } }));
      render(<App />);
      expect(await screen.findByText('Token KO')).toBeTruthy();
      expect(screen.getByText(copy.ui.error_token_hint)).toBeTruthy();
      expect(screen.queryByRole('button', { name: copy.ui.retry })).toBeNull();
      expect(screen.getByRole('button', { name: copy.ui.change_settings })).toBeTruthy();
    },
  );

  it('altri errori: si può riprovare', async () => {
    mockApi(json(502, { error: { code: 'upstream_error', message: 'GitLab giù' } }));
    render(<App />);
    expect(await screen.findByText('GitLab giù')).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.ui.retry })).toBeTruthy();
  });
});
