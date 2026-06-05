# Zama Reef Escape

Privacy-themed arcade game with **Register / Login**, leaderboard, and encrypted-reef gameplay.

## Free stack

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | Angular 19 | Netlify / Vercel free tier |
| Backend | Node.js + Express | Render / Railway free tier |
| Database + Auth | **Supabase** | PostgreSQL + built-in auth (free 500MB) |

## Features

- Register / Login (Supabase Auth, email + password)
- Protected game route — must be logged in to play
- Scores stored in Supabase PostgreSQL
- Leaderboard (public)
- FHE Pearl invisibility + Privacy Reef teleport power-ups

## Quick start (local)

### 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (backend only — never expose in frontend)

4. **Authentication → Providers**: enable Email provider
5. Optional: disable "Confirm email" under Auth settings for faster local testing

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Runs at `http://localhost:3000`

### 3. Frontend

```bash
cd frontend
# Edit src/environments/environment.ts with your Supabase URL + anon key
npm install
npm install @supabase/supabase-js
npm start
```

Runs at `http://localhost:4200`

## Deploy free

### Supabase (database + auth)
Already free — just run the schema SQL in your project.

### Backend → Render
1. Push repo to GitHub
2. New Web Service, root directory: `backend`
3. Build: `npm install` | Start: `npm start`
4. Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`

### Frontend → Netlify
1. Base directory: `frontend`
2. Build: `npm run build`
3. Publish: `dist/frontend/browser`
4. Update `environment.prod.ts` with production API URL + Supabase keys

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/scores` | No | Leaderboard |
| GET | `/api/scores/stats` | No | Global stats |
| POST | `/api/scores` | **JWT required** | Save score |
| GET | `/api/scores/me` | **JWT required** | Your scores |

## Game controls

- Desktop: Arrow keys or WASD
- Mobile: Swipe on canvas

## Project structure

```
zama-reef-escape/
├── frontend/     Angular UI + Supabase Auth client
├── backend/      Express API + Supabase PostgreSQL
├── supabase/     schema.sql
└── README.md
```