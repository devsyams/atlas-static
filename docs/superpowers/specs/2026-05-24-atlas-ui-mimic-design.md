# Atlas UI Mimic (Next.js) — Design

Replicate the UI of `atlas-lovable` (TanStack Start + Vite + React 19 + Tailwind v4 + shadcn)
in a fresh **Next.js** app, covering the **login → Command Center** flow only. UI fidelity is the
goal; backend, widget builder, and the other workspaces are out of scope.

## Stack
- Next.js (latest, App Router) + TypeScript
- Tailwind CSS **v4** with `@theme inline` — port the exact oklch theme tokens from source `styles.css`
- `lucide-react` icons (same set as source)
- `next/font/google`: **Space Grotesk** (display) + **JetBrains Mono** (mono)
- Brand assets `nexorus-icon.png` / `nexorus-logo.png` copied to `public/`
- No Supabase / shadcn / recharts / leaflet — mock visuals via inline SVG + CSS

## Routes
- `/login` — bare (no shell). Mirrors `login.tsx`: glass panel, radial-gradient + grid backdrop,
  Nexorus mark, "Restricted" badge, Operator Sign-In, gradient button. Submit → `/`.
- `/` — Command Center inside `AppShell`. User-menu "Logout" → `/login`.

## Components
- `components/layout/AppShell.tsx` — top command-bar (brand logo, centered ⌘K search [visual only],
  fullscreen / notifications / settings-dropdown-nav / user-menu) + status-strip footer
  ("● System Nominal", "Supabase · Live", "Operator session active", "v0.1.0-alpha").
  Nav dropdown lists the ~12 workspaces for looks; links resolve to `/`.
- `components/layout/PageHeader.tsx` (+ `Panel`) — ported as-is.
- `components/dashboard/*` — mock tiles in the same tile chrome as `index.tsx`, on a 12-col grid:
  4 KPI stats, "Signal Volume — 24h" SVG area chart, "Geospatial Activity" map placeholder,
  "Top Categories" CSS bar chart, "Live Feed" activity list.
- `lib/utils.ts` — `cn()` helper.

## Theme port
`app/globals.css` carries over verbatim: full `:root` oklch palette, `@theme inline` color mappings,
body radial-gradient background, `.panel` / `.panel-glow` / `.text-gradient` / `.bg-gradient-accent`
utilities, custom scrollbars.

## Out of scope
Real auth, widget builder, command palette, the other 10 workspace pages, chart/map libraries.
