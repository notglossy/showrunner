import { z } from 'zod';

const EnvSchema = z.object({
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
  /**
   * Unset = devices register while the dashboard's registration window is open (needs app 0.3+).
   * Set = devices must send it in the X-Kiosk-Secret header, any time (managed fleets).
   */
  DEVICE_SHARED_SECRET: z.string().min(1).optional(),
  DATABASE_PATH: z.string().min(1).default('./data/showrunner.db'),
  WEATHER_LAT: z.coerce.number().min(-90).max(90).default(34.0522),
  WEATHER_LON: z.coerce.number().min(-180).max(180).default(-118.2437),
  WEATHER_UNITS: z.enum(['imperial', 'metric']).default('imperial'),
  KIOSK_TIMEZONE: z
    .string()
    .default('America/Los_Angeles')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'KIOSK_TIMEZONE must be a valid IANA timezone'),
  /** Downloaded Google Fonts. Defaults to a fonts/ folder next to DATABASE_PATH (/data/fonts in Docker). */
  FONTS_DIR: z.string().min(1).optional(),
  /** OpenAI-compatible Chat Completions API used for AI screen generation (OpenRouter by default). */
  AI_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  /** Unset = AI generation disabled in the dashboard. */
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default('google/gemini-3.8-flash'),
  /** docs/screen-authoring.md, sent as the system prompt. Defaults to the repo copy relative to apps/server. */
  AUTHORING_DOC_PATH: z.string().optional(),
  /** Release tag baked into the image by the release workflow (Dockerfile ARG); unset in dev and CI builds. */
  APP_VERSION: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Validated server config. Throws with every problem listed if the environment is invalid. */
export function env(): Env {
  if (!cached) {
    const blankToUndefined = Object.fromEntries(
      Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
    );
    const parsed = EnvSchema.safeParse(blankToUndefined);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment:\n${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Drops the cached env so the next `env()` re-reads process.env. Tests only. */
export function resetEnv(): void {
  cached = undefined;
}
