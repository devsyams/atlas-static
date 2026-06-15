# Backend ask — Nexorus dashboard topic deep link (autologin `redirect`)

> **✅ RESOLVED (2026-06-15).** The OpenGate team shipped `redirect` support on the
> **OpenGate** autologin instead of garudaperkasa:
> `GET https://opengate.nexorus.io/autologin/autologin_generate?api_key=…&redirect=<url-encoded>`
> mints a magic link that signs the user in and then lands on `redirect`. ATLAS
> (P8 v3.0) now mints through OpenGate with the redirect baked into the generate
> call and 307s to the returned `login_url`; the redirect target is the same
> garudaperkasa `dashboard_demo?id=monitoring&idquery=…` (OpenGate is the shared
> SSO). The original ask below is kept for history.

> For the **Nexorus / garudaperkasa** backend team. Audience: whoever owns
> `nexorus.garudaperkasa.io/autologin/*`. Verified live on 2026-06-14.

## What ATLAS needs

ATLAS wants a one-click "View in Nexorus" link on a topic that lands the user,
**already signed in**, on that topic's monitoring view:

```
https://nexorus.garudaperkasa.io/dashboard_demo?id=monitoring&idquery=<idquery>
```

`<idquery>` is the value ATLAS already receives in the topics API response at
`meta.idquery` (e.g. `68ca1a83408aa` for `danantara_main`).

## What works today

- `GET /autologin/autologin_generate?api_key=…` → `{ ok, login_url, expires_in }`. ✅
- Visiting `login_url` (`/autologin/autologin_login?token=…`) sets `PHPSESSID`
  and 302-redirects to a **hardcoded** `dashboard_demo?id=topics`. ✅
- With that session, `dashboard_demo?id=monitoring&idquery=<idquery>` returns
  **200** and renders the monitoring dashboard. ✅

## The gap (blocks the deep link)

The magic link **ignores every destination hint** — all of the following still
land on `dashboard_demo?id=topics`:

| Tried | Result |
|---|---|
| `autologin_generate?…&idquery=…` | `id=topics` |
| `autologin_generate?…&id=monitoring&idquery=…` | `id=topics` |
| `autologin_login?token=…&id=monitoring&idquery=…` | `id=topics` |
| `autologin_login?token=…&redirect=dashboard_demo?…` | `id=topics` |
| `dashboard_demo?…&token=…` / `&api_key=…` (inline auth) | 302 → `loginpage.php` |

The minted token payload only carries `{exp, iat, api_key}` — no destination.
Because the magic link auto-redirects to a fixed page and ATLAS can't act after
the browser is on your domain, **the deep link cannot be completed from ATLAS's
side. One small backend change unblocks it.**

## The change we're asking for (pick one)

**Option 1 (preferred) — honor a `redirect` on the magic link.**
Make `GET /autologin/autologin_login?token=…&redirect=<url>` redirect to
`<url>` after establishing the session, **instead of** the hardcoded
`dashboard_demo?id=topics`.

- **Security:** only honor `redirect` when it is **same-origin**
  (`https://nexorus.garudaperkasa.io/…`) — reject/ignore absolute off-site URLs
  to avoid an open redirect.

ATLAS already builds exactly this and is live-ready:
```
…/autologin/autologin_login?token=…&redirect=https%3A%2F%2Fnexorus.garudaperkasa.io%2Fdashboard_demo%3Fid%3Dmonitoring%26idquery%3D<idquery>
```

**Option 2 — bake the destination into the token at generate time.**
Make `GET /autologin/autologin_generate?api_key=…&id=monitoring&idquery=<idquery>`
encode that destination so the returned `login_url` lands there. (ATLAS would
pass `id`/`idquery` to generate instead of appending `redirect`.)

## ATLAS side (already done)

- BFF route `GET /api/v1/nexorus/topic?idquery=<idquery>` mints the magic link
  server-side (key never leaves the server) and 307s to it with the `redirect`
  param above. Today it signs the user into the dashboard; it becomes
  topic-precise automatically once Option 1 ships. No further ATLAS change needed.
- Config: `NEXORUS_DASHBOARD_AUTOLOGIN_BASE`, `NEXORUS_DASHBOARD_BASE`,
  `NEXORUS_DASHBOARD_API_KEY` (see `.env.example`).

## One open question for the backend team

If you prefer a **different param name** than `redirect` (e.g. `next`, `return_url`),
tell us and we'll match it — it's a one-line change on our side.
