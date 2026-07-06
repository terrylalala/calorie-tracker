# 🥗 AI Calorie & Macro Tracker

Snap a photo of your food and let **Claude** estimate the calories and macros, log
them, and track your intake over time. Includes a one-tap **personalized advice**
button that reviews your recent logs and gives practical, general-wellness tips.

Built with **Next.js (App Router)** + **React**, mobile-first. The Claude API is
called only from **server-side routes**, so your API key never reaches the browser.
Your food log is stored locally in your browser (`localStorage`) — no database, fully
private to your device.

---

## Features

- 📷 **Photo → macros** — capture or upload a food photo; Claude vision estimates
  calories, protein, carbs, and fat, returned as JSON and parsed server-side.
- ✏️ **Editable estimates** — tweak the name, portion, and any macro number before
  saving (AI estimates are approximate).
- ⌨️ **Manual entry** — add foods by typing, no photo required.
- 🎯 **Daily goals** — set calorie + protein/carbs/fat targets; see progress rings.
- 📈 **Trends** — bar chart of daily calories and macro averages over 7 / 30 days.
- 💡 **Personalized advice** — Claude reviews your last ~14 days vs. your goals.

---

## Prerequisites

This machine did **not** have Node.js installed. You'll need it to run the app.

1. **Install Node.js 18.18+ (20+ recommended).**
   - macOS with Homebrew: `brew install node`
   - Or download from <https://nodejs.org/> (LTS installer).
   - Verify: `node -v` and `npm -v`.

2. **Get an Anthropic API key** at <https://console.anthropic.com/> → *API Keys*.

---

## Setup & run

```bash
# 1. Install dependencies
npm install

# 2. Configure your key
cp .env.local.example .env.local
# then edit .env.local and paste your real key into ANTHROPIC_API_KEY

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
settings, add an environment variable `ANTHROPIC_API_KEY` with your key. No database
needed — logs live in each visitor's browser.

---

## How it works

```
Browser (React)
  → capture/upload photo, downscale to JPEG in-browser
  → POST /api/analyze  (base64 image)      ─┐
  → POST /api/advice   (recent logs + goals) │  server-side, key stays here
  → localStorage: entries[], goals{}         ▼
Next.js API routes  →  @anthropic-ai/sdk  →  Claude (claude-opus-4-8)
```

- `app/api/analyze/route.ts` — vision call that instructs Claude to return a JSON
  object (name, portion, per-item + total macros, confidence); the route parses and
  normalizes it defensively into the app's types.
- `app/api/advice/route.ts` — text call grounded in your daily totals vs. goals.

## Notes

- AI estimates are **approximate** — always adjust portions you know better.
- Advice is **general wellness guidance, not medical advice**.
