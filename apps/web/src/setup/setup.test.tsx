import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { exampleWrappedStats } from '@git-wrapped/contracts/examples';
import { SETTINGS_HEADER } from '@git-wrapped/contracts';
import { copy } from '@git-wrapped/copy';
import { App } from '../App';
import { loadSettings } from './storage';

const KEY = 'git-wrapped:settings';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Server finto con stato: non configurato finché `POST /api/settings` non va a buon fine. */
function mockServer(opts: { reject?: { status: number; code: string; message: string } } = {}) {
  let configured = false;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/health')) {
      return json(200, {
        status: 'ok',
        demoMode: false,
        year: exampleWrappedStats.year,
        contractsVersion: 4,
        configured,
      });
    }
    if (url === '/api/settings' && init?.method === 'POST') {
      if (opts.reject) {
        const { status, code, message } = opts.reject;
        return json(status, { error: { code, message } });
      }
      configured = true;
      return json(200, { demoMode: false, displayName: 'Giulia Ferri' });
    }
    if (url.startsWith('/api/me')) return json(200, exampleWrappedStats);
    return json(404, { error: { code: 'not_found', message: 'boh' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const settingsCalls = (fetchMock: ReturnType<typeof mockServer>) =>
  fetchMock.mock.calls.filter(([url]) => url === '/api/settings');

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('schermata iniziale', () => {
  it('senza impostazioni chiede URL, gruppo e token, poi apre il wrapped', async () => {
    const fetchMock = mockServer();
    render(<App />);
    expect(await screen.findByTestId('setup-form')).toBeTruthy();
    fill(copy.ui.setup_url_label, 'https://gitlab.example.test');
    fill(copy.ui.setup_group_label, 'team/backend');
    fill(copy.ui.setup_token_label, 'glpat-finto');
    fireEvent.click(screen.getByRole('button', { name: copy.ui.setup_submit }));

    expect(await screen.findByTestId('calendar-privacy-note')).toBeTruthy();
    const [[, init]] = settingsCalls(fetchMock) as [[string, RequestInit]];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)[SETTINGS_HEADER]).toBe('1');
    expect(JSON.parse(String(init.body))).toEqual({
      mode: 'gitlab',
      gitlabUrl: 'https://gitlab.example.test',
      group: 'team/backend',
      token: 'glpat-finto',
    });
    // Senza «ricorda» il token non resta nel browser; URL e gruppo sì.
    expect(loadSettings()).toEqual({
      gitlabUrl: 'https://gitlab.example.test',
      group: 'team/backend',
    });
  });

  it('con «ricorda» il token resta nel browser e al prossimo avvio entra da solo', async () => {
    mockServer();
    const { unmount } = render(<App />);
    await screen.findByTestId('setup-form');
    fill(copy.ui.setup_token_label, 'glpat-ricordato');
    fireEvent.click(screen.getByLabelText(copy.ui.setup_remember));
    fireEvent.click(screen.getByRole('button', { name: copy.ui.setup_submit }));
    await screen.findByTestId('calendar-privacy-note');
    expect(loadSettings()?.token).toBe('glpat-ricordato');
    unmount();

    // Nuovo avvio con il server di nuovo vuoto (es. container riavviato).
    const restarted = mockServer();
    render(<App />);
    expect(await screen.findByTestId('calendar-privacy-note')).toBeTruthy();
    const [[, init]] = settingsCalls(restarted) as [[string, RequestInit]];
    expect(JSON.parse(String(init.body))).toMatchObject({ token: 'glpat-ricordato' });
  });

  it('mostra l errore del server e resta sulla schermata', async () => {
    mockServer({ reject: { status: 401, code: 'unauthorized', message: 'Token rifiutato' } });
    render(<App />);
    await screen.findByTestId('setup-form');
    fill(copy.ui.setup_token_label, 'glpat-sbagliato');
    fireEvent.click(screen.getByRole('button', { name: copy.ui.setup_submit }));
    expect((await screen.findByTestId('setup-error')).textContent).toBe('Token rifiutato');
    expect(screen.getByTestId('setup-form')).toBeTruthy();
  });

  it('un token ricordato rifiutato viene dimenticato', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        gitlabUrl: 'https://gitlab.example.test',
        group: '',
        token: 'glpat-scaduto',
      }),
    );
    mockServer({ reject: { status: 401, code: 'unauthorized', message: 'Token scaduto' } });
    render(<App />);
    expect(await screen.findByTestId('setup-error')).toBeTruthy();
    expect(loadSettings()).toEqual({ gitlabUrl: 'https://gitlab.example.test', group: '' });
  });

  it('«prova con dati inventati» attiva la demo', async () => {
    const fetchMock = mockServer();
    render(<App />);
    await screen.findByTestId('setup-form');
    fireEvent.click(screen.getByRole('button', { name: copy.ui.setup_demo }));
    await screen.findByTestId('calendar-privacy-note');
    const [[, init]] = settingsCalls(fetchMock) as [[string, RequestInit]];
    expect(JSON.parse(String(init.body))).toEqual({ mode: 'demo' });
  });

  it('dal wrapped si torna alle impostazioni e si può annullare', async () => {
    mockServer();
    render(<App />);
    await screen.findByTestId('setup-form');
    fill(copy.ui.setup_token_label, 'glpat-finto');
    fireEvent.click(screen.getByRole('button', { name: copy.ui.setup_submit }));
    await screen.findByTestId('calendar-privacy-note');

    fireEvent.click(screen.getByRole('button', { name: copy.ui.change_settings }));
    expect(await screen.findByTestId('setup-form')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.ui.setup_cancel }));
    await waitFor(() => expect(screen.queryByTestId('setup-form')).toBeNull());
    expect(await screen.findByTestId('calendar-privacy-note')).toBeTruthy();
  });

  it('il link per creare il token punta all istanza GitLab inserita', async () => {
    mockServer();
    render(<App />);
    await screen.findByTestId('setup-form');
    fill(copy.ui.setup_url_label, 'https://gitlab.example.test/');
    const link = screen.getByRole('link', { name: new RegExp(copy.ui.setup_token_create) });
    expect(link.getAttribute('href')).toBe(
      'https://gitlab.example.test/-/user_settings/personal_access_tokens?name=git-wrapped&scopes=read_api',
    );
  });
});
