import pino from 'pino';
import { env } from './env.js';

const isDev = process.env['NODE_ENV'] !== 'production';

// With exactOptionalPropertyTypes we can't set transport: undefined.
// Branch on two separate option objects instead.
export const logger = isDev
  ? pino({ level: env.LOG_LEVEL, transport: { target: 'pino-pretty', options: { colorize: true } } })
  : pino({ level: env.LOG_LEVEL });
