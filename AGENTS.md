# AGENTS.md

## Commands (project: SMART-TKA, frontend: web/, backend: InsForge CLI)

### Frontend — from `web/` directory
- Lint:        `npx oxlint`
- Typecheck:   `npx tsc --noEmit`
- Build:       `npm run build`
- Dev server:  `npm run dev`          (runs on port 5174; fallback 5173/5176 if in use)

### Backend — from project root `C:\Users\user\Documents\smart-tka`
- Login (device): `npx -y @insforge/cli login --device --json`
- Link staging:  `npx -y @insforge/cli link --project-id a1feb79d-75d9-4605-b0bb-52ab10079efa -y`
- Migrate up:    `npx -y @insforge/cli db migrations up --all`
- Raw SQL:       `npx -y @insforge/cli db query "<sql>" --json`
- Storage:       `npx -y @insforge/cli storage buckets`

### Project layout
- Migrations:  `insforge/migrations/` (also mirrored in `migrations/`)
- Frontend:    `web/src/` — pages in `pages/`, components in `components/`, lib in `lib/`
- Env:         `.env` (never commit — contains VITE_INSFORGE_URL, VITE_INSFORGE_ANON_KEY)
