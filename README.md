# Potato 🍅

A minimal pomodoro timer with a global leaderboard. No sign-up, no login.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS with CSS-variable–driven themes
- Geist Mono via `next/font/google`
- In-memory leaderboard (swap to Vercel KV / D1 for production)

## Run locally

```bash
pnpm install      # or: npm install / yarn
pnpm dev
# open http://localhost:3000
```

## Project layout

```
app/
  layout.tsx               root layout, font + default theme
  globals.css              tailwind + 4 theme variable sets
  page.tsx                 mounts <PotatoApp />
  api/
    geo/                    GET — Cloudflare/IP country detection
    leaderboard/today/     GET — current ranking
    pomodoro/complete/     POST — increments the caller's count
components/
  PotatoApp.tsx            entire UI (client component)
lib/
  flags.ts                 jsDelivr flag URLs + country detection
  nickname.ts              random nickname + clientId
  leaderboard.ts           in-memory daily store (resets daily, UTC)
docs/
  cloudflare-leaderboard-plan.md  production leaderboard + anti-cheat plan
```

## Themes

Edit CSS variables under `[data-theme="..."]` in `app/globals.css`. Each theme
defines `--bg`, `--fg`, `--accent`, `--soft`, `--strong`, `--board-bg`.

Buttons follow the **monochrome rule**: primary CTA uses `bg: var(--fg);
color: var(--bg)` — never a colored fill — so contrast stays high across
every theme.

## Audio

Ambient music and soundscapes are bundled in `public/audio/` and wired to the
bottom-right selector. Source and license details live in
`public/audio/ATTRIBUTION.md`.

## Swapping the leaderboard backend

`lib/leaderboard.ts` is the seam. Replace the in-memory `Map` with calls to
Vercel KV or Cloudflare D1 — the API routes stay the same.

For the Cloudflare Workers/Pages production shape, see
`docs/cloudflare-leaderboard-plan.md`.

Suggested schema:

```sql
CREATE TABLE pomodoro_today (
  date TEXT NOT NULL,
  client_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, client_id)
);
CREATE INDEX idx_today_count ON pomodoro_today(date, count DESC);
```

## Known gaps for production

- Anti-cheat: rate-limit `POST /api/pomodoro/complete` per `clientId`
  (max ~3 per 60 s).
- Persistent backend (see above).
- Mobile breakpoint polish.
