import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[];
};

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) {
    return cached;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }
  const corsOrigins =
    parsed.data.CORS_ORIGINS.trim() === '*'
      ? ['*']
      : parsed.data.CORS_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0);
  cached = { ...parsed.data, corsOrigins };
  return cached;
}

/** @deprecated Prefer loadConfig(). Kept for gradual migration of auth JWT setup. */
export function requiredEnv(name: 'JWT_SECRET' | 'DATABASE_URL'): string {
  const config = loadConfig();
  if (name === 'JWT_SECRET') {
    return config.JWT_SECRET;
  }
  return config.DATABASE_URL;
}

export const SERIES_CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const;
