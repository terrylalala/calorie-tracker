# 🥗 AI Calorie & Macro Tracker

Snap a photo of your food and let **Gemini** estimate the calories and macros, log
them, and track your intake over time. Includes a one-tap **personalized advice**
button that reviews your recent logs and gives practical, general-wellness tips.

Built with **Next.js (App Router)** + **React**, mobile-first. The Gemini API is
called only from **server-side routes**, so your API key never reaches the browser.

Your food log is stored in **Neon Postgres** when a `DATABASE_URL` is configured, so
it syncs across your devices and survives a browser data wipe. Without one, the app
falls back to browser `localStorage` and still works fully offline-of-database.

---

## Features

- 📷 **Photo → macros** — capture or upload a food photo; Gemini vision estimates
  calories, protein, carbs, and fat, returned as structured JSON.
- ✏️ **Editable estimates** — tweak the name, portion, and any macro number before
  saving (AI estimates are approximate).
- ⌨️ **Manual entry** — add foods by typing, no photo required.
- 🎯 **Daily goals** — set calorie + protein/carbs/fat targets; see progress rings.
- 📈 **Trends** — bar chart of daily calories and macro averages over 7 / 30 days.
- 💡 **Personalized advice** — Gemini reviews your last ~14 days vs. your goals.

---

## Prerequisites

This machine did **not** have Node.js installed. You'll need it to run the app.

1. **Install Node.js 18.18+ (20+ recommended).**
   - macOS with Homebrew: `brew install node`
   - Or download from <https://nodejs.org/> (LTS installer).
   - Verify: `node -v` and `npm -v`.

2. **Get a Gemini API key** at <https://aistudio.google.com/apikey> (Google AI Studio).

---

## Setup & run

```bash
# 1. Install dependencies
npm install

# 2. Configure your key
cp .env.local.example .env.local
# then edit .env.local and paste your real key into GEMINI_API_KEY

# 3. Start the dev server
npm run dev
```

Open <http://localhost:3000> — on your phone, open your computer's LAN address
(e.g. `http://192.168.1.20:3000`) to use the camera. For best results, add it to
your home screen so it runs full-screen.

Production build:

```bash
npm run build && npm start
```

---

## Deploy (optional)

Push to GitHub and import into [Vercel](https://vercel.com). In the Vercel project
settings, add an environment variable `GEMINI_API_KEY` with your key. No database
needed — logs live in each visitor's browser.

### Accounts (sharing with other people)

With a database configured, the app is **multi-user**:

- People **sign in with Google** — no passwords are ever stored by this app.
- Signing in isn't enough: a new account must be admitted with the **invite code**
  (`APP_PASSWORD`). Share that code only with people you want using the app.
- Every meal, goal and profile is scoped to the signed-in account. One account
  cannot read, modify or delete another's data.
- The **first** registered account adopts any data created before accounts existed.
- Each account has a **daily cap** on AI calls (`DAILY_ANALYZE_LIMIT`,
  `DAILY_ADVICE_LIMIT`) so one enthusiastic user can't run up the whole Gemini bill.
- The invite endpoint is **brute-force protected**: 10 wrong codes from one IP
  triggers a 15-minute lockout (failures older than an hour are forgiven). This
  matters once the Google app is published, because the invite code is then the
  only thing between a stranger and an account.

Google OAuth setup: Google Cloud → *Google Auth Platform* → **Clients** → Web
application, with redirect URIs `http://localhost:3000/api/auth/callback/google`
and `https://YOUR-DOMAIN/api/auth/callback/google`. While the app is in *Testing*,
only emails listed under **Audience → Test users** can sign in; publish the app to
let anyone with the invite code join.

Without a database the app stays single-user and falls back to `APP_PASSWORD` as a
simple shared gate.

---

## Storage

| | With `DATABASE_URL` | Without |
|---|---|---|
| Log lives in | Neon Postgres | browser `localStorage` |
| Syncs across devices | ✅ | ❌ (per-device) |
| Survives clearing browser data | ✅ | ❌ |

On first load with a database configured, any logs already in your browser are
**migrated up automatically** (one time), so nothing you've tracked is lost.
localStorage is still kept as a local mirror for offline viewing.

Tables (`entries`, `settings`) are created automatically on first use — no
migration step to run.

## How it works

```
Browser (React)
  → capture/upload photo, downscale to JPEG in-browser
  → POST /api/analyze  (base64 image)        ─┐
  → POST /api/advice   (recent logs + goals)  │  server-side, key stays here
  → GET/POST/DELETE /api/entries              │  food log CRUD
  → GET/PUT /api/settings                     ▼
Next.js API routes  →  @google/genai      →  Gemini (gemini-flash-latest)
                    →  @neondatabase/serverless  →  Neon Postgres
```

- `app/api/analyze/route.ts` — vision call using Gemini's structured output
  (`responseSchema`) to return name, portion, per-item + total macros, and confidence;
  the route parses and normalizes it defensively into the app's types.
- `app/api/advice/route.ts` — text call grounded in your daily totals vs. goals.

## Notes

- AI estimates are **approximate** — always adjust portions you know better.
- Advice is **general wellness guidance, not medical advice**.
