import { COUNTRY_CODES, normalizeCountry } from "@/lib/flags";
import { bumpCount, clientToday, leaderboardToday } from "@/lib/leaderboard";
import {
  D1DatabaseBinding,
  getRuntime,
  PotatoEnv,
} from "@/lib/server/cloudflare";

type Mode = "focus" | "short" | "long";

export type LeaderboardRow = {
  rank: number;
  nickname: string;
  country: string;
  count: number;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type SessionRow = {
  client_id: string;
  completed_at: number | null;
  expires_at: number;
  min_complete_at: number;
  mode: string;
  session_id: string;
  status: string;
};

const LOCAL_SALT = "potato-local-development-salt";
const MAX_DAILY_TARGET = 16;
const DEFAULT_FOCUS_SECONDS = 25 * 60;
const DEFAULT_TOLERANCE_SECONDS = 30;
const DEFAULT_EXPIRES_SECONDS = 60 * 60;
const HOUR_MS = 60 * 60 * 1000;

const numberFromEnv = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const todayUtc = () => new Date().toISOString().slice(0, 10);

function sanitizeClientId(value: string | undefined): string {
  return (value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function sanitizeNickname(value: string | undefined): string {
  return (value || "anon").trim().replace(/\s+/g, " ").slice(0, 14) || "anon";
}

function sanitizeMode(value: string | undefined): Mode {
  return value === "short" || value === "long" ? value : "focus";
}

function sanitizeDisplayCountry(value: string | undefined): string {
  const country = normalizeCountry(value);
  return COUNTRY_CODES.includes(country as (typeof COUNTRY_CODES)[number])
    ? country
    : "us";
}

function getConfig(env: PotatoEnv | undefined) {
  const focusSeconds = numberFromEnv(
    env?.SESSION_DURATION_SECONDS,
    DEFAULT_FOCUS_SECONDS,
    60,
    DEFAULT_FOCUS_SECONDS,
  );
  const toleranceSeconds = numberFromEnv(
    env?.SESSION_TOLERANCE_SECONDS,
    DEFAULT_TOLERANCE_SECONDS,
    0,
    120,
  );
  return {
    dailyTarget: numberFromEnv(env?.DAILY_TARGET, MAX_DAILY_TARGET, 1, MAX_DAILY_TARGET),
    expiresSeconds: numberFromEnv(
      env?.SESSION_EXPIRES_SECONDS,
      DEFAULT_EXPIRES_SECONDS,
      focusSeconds,
      24 * 60 * 60,
    ),
    focusSeconds,
    toleranceSeconds: Math.min(toleranceSeconds, focusSeconds - 1),
  };
}

function ipFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    request.headers.get("cf-connecting-ip") ||
    (forwarded ? forwarded.split(",")[0]?.trim() : "") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function countryFromRequest(
  request: Request,
  cf: Record<string, unknown> | undefined,
): string {
  const cfCountry = typeof cf?.country === "string" ? cf.country : undefined;
  const headerCountry =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code");
  return normalizeCountry(cfCountry || headerCountry || "us");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function requestProfile(
  request: Request,
  env: PotatoEnv | undefined,
  cf: Record<string, unknown> | undefined,
) {
  const salt = env?.LEADERBOARD_SECRET_SALT || LOCAL_SALT;
  const ip = ipFromRequest(request);
  const ua = request.headers.get("user-agent") || "unknown";
  return {
    country: countryFromRequest(request, cf),
    ipHash: await sha256Hex(`${salt}:ip:${ip}`),
    uaHash: await sha256Hex(`${salt}:ua:${ua}`),
  };
}

async function auditReject(
  db: D1DatabaseBinding,
  input: {
    clientId?: string;
    country?: string;
    ipHash?: string;
    reason: string;
    sessionId?: string;
    uaHash?: string;
  },
) {
  await db
    .prepare(
      `INSERT INTO rejected_events
        (id, session_id, client_id, reason, created_at, ip_hash, ua_hash, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.sessionId || null,
      input.clientId || null,
      input.reason,
      Date.now(),
      input.ipHash || null,
      input.uaHash || null,
      input.country || null,
    )
    .run();
}

async function validateTurnstile(
  token: string | undefined,
  remoteIp: string,
  env: PotatoEnv,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (remoteIp !== "unknown") body.append("remoteip", remoteIp);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      body,
      method: "POST",
    },
  );
  if (!response.ok) return false;
  const data = (await response.json()) as { success?: boolean };
  return data.success === true;
}

async function startD1Session(
  db: D1DatabaseBinding,
  request: Request,
  env: PotatoEnv,
  cf: Record<string, unknown> | undefined,
  input: { clientId: string; country: string; mode: Mode; nickname: string },
) {
  const now = Date.now();
  const config = getConfig(env);
  const profile = await requestProfile(request, env, cf);
  const minCompleteAt = now + (config.focusSeconds - config.toleranceSeconds) * 1000;
  const expiresAt = now + (config.focusSeconds + config.expiresSeconds) * 1000;
  const sessionId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO clients
        (client_id, nickname, country, created_at, last_seen_at, ip_hash, ua_hash, risk_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(client_id) DO UPDATE SET
        nickname = excluded.nickname,
        country = excluded.country,
        last_seen_at = excluded.last_seen_at,
        ip_hash = excluded.ip_hash,
        ua_hash = excluded.ua_hash`,
    )
    .bind(
      input.clientId,
      input.nickname,
      input.country,
      now,
      now,
      profile.ipHash,
      profile.uaHash,
    )
    .run();

  const recentIpStarts = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM timer_sessions
       WHERE ip_hash = ? AND started_at > ?`,
    )
    .bind(profile.ipHash, now - HOUR_MS)
    .first<{ count: number }>();

  if ((recentIpStarts?.count || 0) > 80) {
    await auditReject(db, {
      clientId: input.clientId,
      country: profile.country,
      ipHash: profile.ipHash,
      reason: "ip_rate_limited",
      uaHash: profile.uaHash,
    });
    return { ok: false, error: "rate_limited", status: 429 } as const;
  }

  await db
    .prepare(
      `UPDATE timer_sessions
       SET status = 'superseded'
       WHERE client_id = ? AND mode = 'focus' AND status = 'open'`,
    )
    .bind(input.clientId)
    .run();

  await db
    .prepare(
      `INSERT INTO timer_sessions
        (session_id, client_id, mode, started_at, min_complete_at, expires_at,
         ip_hash, ua_hash, country, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
    )
    .bind(
      sessionId,
      input.clientId,
      input.mode,
      now,
      minCompleteAt,
      expiresAt,
      profile.ipHash,
      profile.uaHash,
      profile.country,
    )
    .run();

  return {
    ok: true,
    data: {
      expiresAt,
      minCompleteAt,
      sessionId,
    },
  } as const;
}

type MemorySession = {
  clientId: string;
  expiresAt: number;
  minCompleteAt: number;
  mode: Mode;
  status: "open" | "completed" | "superseded";
};

type MemoryStore = {
  sessions: Map<string, MemorySession>;
};

const memoryGlobal = globalThis as typeof globalThis & {
  __potatoSessionStore?: MemoryStore;
};

function getMemoryStore(): MemoryStore {
  if (!memoryGlobal.__potatoSessionStore) {
    memoryGlobal.__potatoSessionStore = { sessions: new Map() };
  }
  return memoryGlobal.__potatoSessionStore;
}

function startMemorySession(
  env: PotatoEnv | undefined,
  input: { clientId: string; mode: Mode },
) {
  const now = Date.now();
  const config = getConfig(env);
  const sessionId = crypto.randomUUID();
  const store = getMemoryStore();
  for (const session of store.sessions.values()) {
    if (session.clientId === input.clientId && session.status === "open") {
      session.status = "superseded";
    }
  }
  const minCompleteAt = now + (config.focusSeconds - config.toleranceSeconds) * 1000;
  const expiresAt = now + (config.focusSeconds + config.expiresSeconds) * 1000;
  store.sessions.set(sessionId, {
    clientId: input.clientId,
    expiresAt,
    minCompleteAt,
    mode: input.mode,
    status: "open",
  });

  return {
    ok: true,
    data: {
      expiresAt,
      minCompleteAt,
      sessionId,
    },
  } as const;
}

export async function startSession(
  request: Request,
  body: {
    clientId?: string;
    country?: string;
    mode?: string;
    nickname?: string;
  },
): Promise<
  ApiResult<{ expiresAt: number; minCompleteAt: number; sessionId: string }>
> {
  const input = {
    clientId: sanitizeClientId(body.clientId),
    country: sanitizeDisplayCountry(body.country),
    mode: sanitizeMode(body.mode),
    nickname: sanitizeNickname(body.nickname),
  };

  if (!input.clientId) {
    return { ok: false, error: "missing_clientId", status: 400 };
  }
  if (input.mode !== "focus") {
    return { ok: false, error: "unsupported_mode", status: 400 };
  }

  const runtime = await getRuntime();
  if (!runtime?.env.DB) {
    return startMemorySession(runtime?.env, input);
  }
  return startD1Session(runtime.env.DB, request, runtime.env, runtime.cf, input);
}

async function completeD1Session(
  db: D1DatabaseBinding,
  request: Request,
  env: PotatoEnv,
  cf: Record<string, unknown> | undefined,
  input: {
    clientId: string;
    country: string;
    nickname: string;
    sessionId: string;
    turnstileToken?: string;
  },
) {
  const now = Date.now();
  const date = todayUtc();
  const config = getConfig(env);
  const profile = await requestProfile(request, env, cf);

  const session = await db
    .prepare(
      `SELECT session_id, client_id, mode, min_complete_at, expires_at, completed_at, status
       FROM timer_sessions
       WHERE session_id = ?`,
    )
    .bind(input.sessionId)
    .first<SessionRow>();

  const reject = async (error: string, status = 400) => {
    await db
      .prepare(
        `UPDATE clients
         SET risk_score = risk_score + 1
         WHERE client_id = ?`,
      )
      .bind(input.clientId)
      .run();
    await auditReject(db, {
      clientId: input.clientId,
      country: profile.country,
      ipHash: profile.ipHash,
      reason: error,
      sessionId: input.sessionId,
      uaHash: profile.uaHash,
    });
    return { ok: false, error, status } as const;
  };

  if (!session) return reject("session_not_found", 404);
  if (session.client_id !== input.clientId) return reject("wrong_client", 403);
  if (session.status !== "open" || session.completed_at) {
    return reject("session_already_closed", 409);
  }
  if (session.mode !== "focus") return reject("unsupported_mode", 400);
  if (now < session.min_complete_at) return reject("too_early", 409);
  if (now > session.expires_at) return reject("session_expired", 409);

  const client = await db
    .prepare("SELECT risk_score FROM clients WHERE client_id = ?")
    .bind(input.clientId)
    .first<{ risk_score: number }>();

  if ((client?.risk_score || 0) >= 6) {
    const passed = await validateTurnstile(
      input.turnstileToken,
      ipFromRequest(request),
      env,
    );
    if (!passed) return reject("turnstile_required", 403);
  }

  const existing = await db
    .prepare(
      `SELECT count
       FROM daily_scores
       WHERE date = ? AND client_id = ?`,
    )
    .bind(date, input.clientId)
    .first<{ count: number }>();

  if ((existing?.count || 0) >= config.dailyTarget) {
    return reject("daily_cap_reached", 409);
  }

  const update = await db
    .prepare(
      `UPDATE timer_sessions
       SET completed_at = ?, status = 'completed'
       WHERE session_id = ?
         AND client_id = ?
         AND status = 'open'
         AND min_complete_at <= ?
         AND expires_at >= ?`,
    )
    .bind(now, input.sessionId, input.clientId, now, now)
    .run();

  if ((update.meta?.changes || 0) !== 1) {
    return reject("session_already_closed", 409);
  }

  const scoreUpdate = await db
    .prepare(
      `INSERT INTO daily_scores
        (date, client_id, nickname, country, count, first_completed_at, last_completed_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(date, client_id) DO UPDATE SET
        nickname = excluded.nickname,
        country = excluded.country,
        count = daily_scores.count + 1,
        first_completed_at = COALESCE(daily_scores.first_completed_at, excluded.first_completed_at),
        last_completed_at = excluded.last_completed_at
       WHERE daily_scores.count < ?`,
    )
    .bind(
      date,
      input.clientId,
      input.nickname,
      input.country,
      now,
      now,
      config.dailyTarget,
    )
    .run();

  if ((scoreUpdate.meta?.changes || 0) !== 1) {
    return reject("daily_cap_reached", 409);
  }

  const score = await db
    .prepare(
      `SELECT count, last_completed_at
       FROM daily_scores
       WHERE date = ? AND client_id = ?`,
    )
    .bind(date, input.clientId)
    .first<{ count: number; last_completed_at: number }>();

  const count = score?.count || 0;
  const rankRow = await db
    .prepare(
      `SELECT COUNT(*) + 1 AS rank
       FROM daily_scores
       WHERE date = ?
         AND (
           count > ?
           OR (count = ? AND last_completed_at < ?)
         )`,
    )
    .bind(date, count, count, score?.last_completed_at || now)
    .first<{ rank: number }>();

  return {
    ok: true,
    data: {
      todayCount: count,
      todayRank: rankRow?.rank || 1,
    },
  } as const;
}

function completeMemorySession(
  env: PotatoEnv | undefined,
  input: {
    clientId: string;
    country: string;
    nickname: string;
    sessionId: string;
  },
) {
  const now = Date.now();
  const session = getMemoryStore().sessions.get(input.sessionId);
  if (!session) {
    return { ok: false, error: "session_not_found", status: 404 } as const;
  }
  if (session.clientId !== input.clientId) {
    return { ok: false, error: "wrong_client", status: 403 } as const;
  }
  if (session.status !== "open") {
    return { ok: false, error: "session_already_closed", status: 409 } as const;
  }
  if (now < session.minCompleteAt) {
    return { ok: false, error: "too_early", status: 409 } as const;
  }
  if (now > session.expiresAt) {
    return { ok: false, error: "session_expired", status: 409 } as const;
  }

  if ((clientToday(input.clientId)?.count || 0) >= getConfig(env).dailyTarget) {
    return { ok: false, error: "daily_cap_reached", status: 409 } as const;
  }

  session.status = "completed";
  const { count, rank } = bumpCount(
    input.clientId,
    input.nickname,
    input.country,
  );
  return {
    ok: true,
    data: {
      todayCount: count,
      todayRank: rank,
    },
  } as const;
}

export async function completeSession(
  request: Request,
  body: {
    clientId?: string;
    country?: string;
    nickname?: string;
    sessionId?: string;
    turnstileToken?: string;
  },
): Promise<ApiResult<{ todayCount: number; todayRank: number }>> {
  const input = {
    clientId: sanitizeClientId(body.clientId),
    country: sanitizeDisplayCountry(body.country),
    nickname: sanitizeNickname(body.nickname),
    sessionId: (body.sessionId || "").trim(),
    turnstileToken: body.turnstileToken,
  };

  if (!input.clientId) {
    return { ok: false, error: "missing_clientId", status: 400 };
  }
  if (!input.sessionId) {
    return { ok: false, error: "missing_sessionId", status: 400 };
  }

  const runtime = await getRuntime();
  if (!runtime?.env.DB) {
    return completeMemorySession(runtime?.env, input);
  }
  return completeD1Session(runtime.env.DB, request, runtime.env, runtime.cf, input);
}

export async function getTodayLeaderboard(
  request: Request,
): Promise<{
  me?: { count: number; rank: number };
  online: number;
  rows: LeaderboardRow[];
}> {
  const runtime = await getRuntime();
  const url = new URL(request.url);
  const clientId = sanitizeClientId(url.searchParams.get("clientId") || undefined);

  if (!runtime?.env.DB) {
    const data = leaderboardToday(20);
    return {
      ...data,
      me: clientId ? clientToday(clientId) || { count: 0, rank: data.rows.length + 1 } : undefined,
    };
  }

  const db = runtime.env.DB;
  const date = todayUtc();
  const now = Date.now();
  const rowsResult = await db
    .prepare(
      `SELECT nickname, country, count
       FROM daily_scores
       WHERE date = ?
       ORDER BY count DESC, last_completed_at ASC
       LIMIT 20`,
    )
    .bind(date)
    .all<{ nickname: string; country: string; count: number }>();

  const onlineRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM clients
       WHERE last_seen_at > ?`,
    )
    .bind(now - 10 * 60 * 1000)
    .first<{ count: number }>();

  let me: { count: number; rank: number } | undefined;
  if (clientId) {
    await db
      .prepare(
        `UPDATE clients
         SET last_seen_at = ?
         WHERE client_id = ?`,
      )
      .bind(now, clientId)
      .run();

    const score = await db
      .prepare(
        `SELECT count, last_completed_at
         FROM daily_scores
         WHERE date = ? AND client_id = ?`,
      )
      .bind(date, clientId)
      .first<{ count: number; last_completed_at: number }>();

    if (score) {
      const rank = await db
        .prepare(
          `SELECT COUNT(*) + 1 AS rank
           FROM daily_scores
           WHERE date = ?
             AND (
               count > ?
               OR (count = ? AND last_completed_at < ?)
             )`,
        )
        .bind(date, score.count, score.count, score.last_completed_at)
        .first<{ rank: number }>();
      me = { count: score.count, rank: rank?.rank || 1 };
    } else {
      me = { count: 0, rank: (rowsResult.results?.length || 0) + 1 };
    }
  }

  return {
    me,
    online: onlineRow?.count || 0,
    rows: (rowsResult.results || []).map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      country: normalizeCountry(row.country),
      count: row.count,
    })),
  };
}
