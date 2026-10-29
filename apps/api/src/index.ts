import { loadConfig, type AppConfig } from './config';
import { createDemoSource, createGitLabSource } from './gitlab';
import { createLogger } from './logger';
import { buildServer } from './server';

const HOST = '0.0.0.0';
const PORT = 3000;

async function main(): Promise<void> {
  const logger = createLogger(process.env['LOG_LEVEL'] ?? 'info');
  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (err) {
    // I messaggi di ConfigError non contengono mai il token.
    logger.fatal(err instanceof Error ? err.message : 'Configurazione non valida.');
    process.exit(1);
  }

  const source = config.demoMode
    ? createDemoSource(undefined, config.timezone)
    : createGitLabSource(
        {
          url: config.gitlabUrl,
          token: config.gitlabToken,
          group: config.gitlabGroup,
          ...(config.gitlabCaCert ? { caCert: config.gitlabCaCert } : {}),
        },
        // Le cache interne del collettore scadono come quella delle statistiche: un solo
        // parametro (CACHE_TTL_MINUTES) decide quanto restano in RAM i dati di GitLab.
        { cacheTtlMs: config.cacheTtlMinutes * 60_000, timeZone: config.timezone },
      );

  const app = buildServer({ source, config, logger });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'arresto in corso');
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ host: HOST, port: PORT });
  logger.info({ demoMode: config.demoMode, year: config.year }, 'api in ascolto');
}

main().catch((err: unknown) => {
  // Solo il tipo dell'errore: il messaggio potrebbe contenere dati.
  console.error('Avvio fallito:', err instanceof Error ? err.name : 'errore');
  process.exit(1);
});
