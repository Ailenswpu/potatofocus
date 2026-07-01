# Cloudflare leaderboard plan

This is the production path for Potato on Cloudflare. The goal is a tiny app surface, a trustworthy daily leaderboard, and enough anti-cheat without forcing account signup.

## Deployment shape

Use Cloudflare Workers for the Next.js app via the Cloudflare OpenNext adapter. Cloudflare's current Next.js guide says App Router, Route Handlers, SSR, SSG, and related features are supported through the adapter, and recommends `npm run preview` for a workerd-accurate production check.

If we split frontend and API later:

- Cloudflare Pages: static UI shell and public audio assets.
- Cloudflare Worker: `/api/*` routes, leaderboard writes, geo, rate limits.
- Custom domain: `potato.studywithme.app`, with the Worker mounted at the same origin to avoid CORS and reduce client complexity.

## Data model

Use D1 for durable leaderboard state. D1 is Cloudflare's serverless SQLite-compatible database for Workers and Pages, which fits daily ranking queries well.

```sql
CREATE TABLE clients (
  client_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE timer_sessions (
  session_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  min_complete_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  ip_hash TEXT,
  ua_hash TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE daily_scores (
  date TEXT NOT NULL,
  client_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  first_completed_at INTEGER,
  last_completed_at INTEGER,
  PRIMARY KEY (date, client_id)
);

CREATE INDEX idx_daily_scores_rank ON daily_scores(date, count DESC, last_completed_at ASC);
CREATE INDEX idx_timer_sessions_client ON timer_sessions(client_id, started_at DESC);
```

## API flow

1. `GET /api/geo`

   Returns a country from Cloudflare's request metadata or `CF-IPCountry`. The client uses this only when the user has not manually selected a flag.

2. `POST /api/session/start`

   The server creates a `timer_sessions` row with `min_complete_at = now + 25m - tolerance`. It returns only an opaque `session_id`. The client timer is display-only.

3. `POST /api/session/complete`

   The server verifies:

   - session exists and belongs to `client_id`
   - session is still `open`
   - `now >= min_complete_at`
   - `now <= expires_at`
   - mode is `focus`
   - per-client daily cap has not exceeded the product target
   - IP/device rate limits pass

   Only then does it mark the session `completed` and increment `daily_scores`.

4. `GET /api/leaderboard/today`

   Reads from `daily_scores`, ordered by count. Cache the top list for 5-15 seconds at the edge if traffic grows.

## Anti-cheat layers

No anonymous web leaderboard is perfectly cheat-proof, so the design blocks cheap cheating and flags suspicious behavior.

- Server-issued sessions: users cannot POST arbitrary completions without a previously started session.
- Minimum duration: completion before `min_complete_at` is rejected.
- One-time completion: a session can only transition from `open` to `completed` once.
- Request country is server-owned: save country from Cloudflare metadata, not from client payload, except for display-only manual flag preference.
- Rate limiting: use Cloudflare Workers Rate Limiting binding for write endpoints, plus per-client/day checks in D1.
- Strong serialization: use a Durable Object keyed by `client_id + date` when moving from demo to production. Durable Objects provide stateful coordination and strongly consistent storage, so concurrent completion requests cannot race double increments.
- Risk score: hash IP and user-agent with a secret salt, then increase risk for impossible completion cadence, many clients from one IP, frequent nickname changes, or repeated early-complete attempts.
- Turnstile challenge: require Turnstile only when risk score is high or a client exceeds normal write patterns. Turnstile server validation uses the `siteverify` endpoint with secret + response token.
- Audit log: keep rejected completion events for manual review and abuse tuning.

## Worker implementation notes

- Generate IDs with Web Crypto, not `Math.random()`.
- Keep request-scoped data inside the request handler.
- Use bindings for D1, Durable Objects, and rate limiting instead of calling Cloudflare REST APIs from the Worker.
- Use `ctx.waitUntil()` only for non-critical audit logging after the response.
- Enable structured logs/observability in Wrangler before launch.

## Brand and product additions

Keep the first viewport focused on the timer. Brand content should live in the tiny top-right secondary menu, not in the timer surface.

Now:

- Contact link for support and press.
- GitHub link for credibility and issue reports.
- Twitter/X link for launch updates.

Next:

- Short `/about` page with product principles, privacy posture, and audio credits.
- Public changelog in GitHub releases or a lightweight `/updates` page.
- Privacy page that explains local storage, anonymous leaderboard IDs, IP-derived country, and anti-abuse hashing.
- Optional share card after completing a focus session, never before.

Do not add a marketing hero to the timer screen. The product's brand is the quietness of the timer itself.
