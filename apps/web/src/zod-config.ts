import { z } from 'zod';

/**
 * zod 4 prova `new Function` per compilare i parser più veloci: con la CSP `script-src 'self'`
 * (senza 'unsafe-eval') la prova genera una violazione in console. In modalità jitless zod non
 * la tenta. Va importato per primo in `main.tsx`, prima che i contratti creino gli schemi.
 */
z.config({ jitless: true });
