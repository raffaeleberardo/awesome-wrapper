import { pino, type DestinationStream, type Logger } from 'pino';

/**
 * Logger senza transport a worker (funziona impacchettato con esbuild).
 * La redazione è una seconda linea di difesa: il codice non logga mai username,
 * URL reali né corpi; qui si coprono comunque header, token e qualsiasi campo username.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'cookie',
  'token',
  'password',
  'username',
  '*.token',
  '*.username',
  '*.authorization',
  '*.cookie',
  '*.*.username',
  '*.*.token',
];

export function createLogger(level = 'info', destination?: DestinationStream): Logger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: '[redatto]' } }, destination);
}
