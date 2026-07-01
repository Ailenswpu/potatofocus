import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Result<T = unknown> = {
  results?: T[];
  meta?: {
    changes?: number;
  };
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
};

export type D1DatabaseBinding = {
  prepare(query: string): D1PreparedStatement;
  batch?(statements: D1PreparedStatement[]): Promise<D1Result[]>;
};

export type PotatoEnv = {
  DB?: D1DatabaseBinding;
  DAILY_TARGET?: string;
  ENVIRONMENT?: string;
  LEADERBOARD_SECRET_SALT?: string;
  SESSION_DURATION_SECONDS?: string;
  SESSION_EXPIRES_SECONDS?: string;
  SESSION_TOLERANCE_SECONDS?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export type CloudflareRuntime = {
  cf?: Record<string, unknown>;
  env: PotatoEnv;
};

export async function getRuntime(): Promise<CloudflareRuntime | null> {
  try {
    const context = await getCloudflareContext({ async: true });
    return {
      cf: context.cf,
      env: context.env as PotatoEnv,
    };
  } catch {
    return null;
  }
}

