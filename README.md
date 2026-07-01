# Potato 🍅

A minimal pomodoro timer with a global leaderboard. No sign-up, no login.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS with CSS-variable–driven themes
- Geist Mono via `next/font/google`
- Cloudflare Workers via OpenNext
- Cloudflare D1 leaderboard with server-issued focus sessions

## Run locally

```bash
npm install
npm run d1:migrate:local
npm run dev -- -p 3001
# open http://localhost:3001
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
    session/start/          POST — creates a server-issued focus session
    session/complete/       POST — completes a valid focus session
    pomodoro/complete/     POST — compatibility wrapper around session complete
components/
  PotatoApp.tsx            entire UI (client component)
lib/
  flags.ts                 jsDelivr flag URLs + country detection
  nickname.ts              random nickname + clientId
  leaderboard.ts           local dev fallback daily store
  server/leaderboard.ts    D1-backed leaderboard and anti-cheat checks
docs/
  cloudflare-leaderboard-plan.md  production leaderboard + anti-cheat plan
  cloudflare-deployment.md        D1 + Workers deployment steps
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

## Cloudflare deployment

The production deployment uses `wrangler.jsonc`, `open-next.config.ts`, and the
D1 migration in `migrations/0001_leaderboard.sql`. Full steps are in
`docs/cloudflare-deployment.md`.

The leaderboard anti-cheat flow is:

1. Focus start creates `/api/session/start`.
2. Focus completion calls `/api/session/complete`.
3. The server rejects missing sessions, early completions, expired sessions,
   replayed sessions, and counts above the daily target.
4. D1 stores daily scores, client metadata, timer sessions, and rejected events.
