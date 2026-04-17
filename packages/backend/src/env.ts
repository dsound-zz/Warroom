import { z } from 'zod';
import { config } from 'dotenv';

config({ path: new URL('../../../.env', import.meta.url).pathname });

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  BACKEND_PORT: z.coerce.number().int().positive().default(8000),
  TZ: z.string().default('America/New_York'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
