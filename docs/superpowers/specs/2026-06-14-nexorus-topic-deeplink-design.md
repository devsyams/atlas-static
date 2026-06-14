# Nexorus topic deep link (autologin) — design

> Date: 2026-06-14 · Feature: **P8** (Nexorus cross-app link) → **v2.0** · Stage: 0-platform
> Status: design approved, pre-implementation

## Problem

The topics API now returns an `idQuery` per topic. Nexorus exposes a per-topic detail
page at `https://nexorus.garudaperkasa.io/dashboard_demo?id=monitoring&idquery=<idQuery>`
(e.g. `…?id=monitoring&idquery=694368b190153`). Today the ATLAS gear menu (P8 v1.0) can
land a signed-in user on the **Nexorus dashboard home** via an OpenGate autologin magic
link, but there is no way to jump straight from a specific ATLAS topic to **that same
topic** inside Nexorus. The exec sees a topic on the Danantara/BUMN board, wants the full
Nexorus view of it, and has to navigate there by hand.

The Nexorus dashboard is session-gated and login is minted exactly like the existing
OpenGate magic link (same `autologin_generate`-style call; `api_key` stays server-side).
The minted login URL lands the user on the right destination **based on `idquery`**: pass
an `idquery` → that topic; pass none → the dashboard home (today's behavior).

## Decisions (from brainstorming)

- **Two entry points, but only one is new work.** The gear-menu "Nexorus Opengate" item
  already lands on the Nexorus dashboard home (confirmed: OpenGate == Nexorus dashboard
  home). **No gear-menu change.** The only new build is the **per-topic deep link** inside
  the topic detail modal.
- **Auth:** the deep link is session-gated and cannot be a plain client `<a>` to the
  dashboard URL — it must route through the server-side magic-link BFF (`api_key` stays
  server-side).
- **`id=monitoring` is constant.** Only `idquery` varies per topic; it arrives per-topic
  from the topics API.

## Approach (A — reuse the existing BFF)

Extend the existing `app/api/v1/opengate/autologin/route.ts` to accept **one** optional,
validated query param: `idquery`.

- **No `idquery`** (gear menu, unchanged) → mints the magic link → Nexorus dashboard home.
- **With `idquery`** (new, from the topic modal) → forwards `idquery` to the
  `autologin_generate` call so the returned `login_url` lands on the topic
  (`dashboard_demo?id=monitoring&idquery=<idquery>`).
- Invalid / empty / garbage `idquery` → degrades to home, never a dead end.

All existing P8 guardrails are kept: requires the `atlas_auth` cookie, `api_key` never
client-side, `force-dynamic` (fresh link per click), 5 s upstream timeout, every failure
mode 307s to the Nexorus/OpenGate home.

Rejected: a second `/api/v1/nexorus/*` route (duplicates the auth/fallback/timeout logic
for one shared contract); a client-side direct link (page is session-gated, `api_key`
must stay server-side).

## Data flow (carry `idQuery` per-topic)

```
upstream topics JSON (idQuery per topic)
  → UpstreamTopic.idQuery          (lib/danantara/ceo/topics-source.ts)
  → toIssue() maps it
  → CeoIssue.idQuery?: string      (lib/danantara/ceo/types.ts)
  → DetailModal issue variant      (components/danantara/ceo/DetailModal.tsx)
      renders "View in Nexorus" → /api/v1/opengate/autologin?idquery=<encoded>
                                   target="_blank" rel="noopener"
```

When a topic has **no** `idQuery`, the button does not render (graceful degradation — older
feed payloads keep working unchanged).

## Files

- `change` `app/api/v1/opengate/autologin/route.ts` — accept + validate `idquery`; forward
  it to the upstream autologin call; topic `login_url` on success, home on any failure.
- `change` `app/api/v1/opengate/autologin/route.test.ts` — new cases for the `idquery` path.
- `change` `lib/danantara/ceo/topics-source.ts` — `UpstreamTopic.idQuery`; map it in `toIssue`.
- `change` `lib/danantara/ceo/types.ts` — `CeoIssue.idQuery?: string`.
- `change` `lib/danantara/ceo/topics-source.test.ts` — `idQuery` survives mapping; absent → undefined.
- `change` `components/danantara/ceo/DetailModal.tsx` — "View in Nexorus" link in the issue body.
- `change` `components/danantara/ceo/DetailModal.test.tsx` — renders with `idQuery`, hidden without.
- `change` `.env.example` — document `NEXORUS_DASHBOARD_BASE` if a configurable base is needed.

## Testing (TDD, vitest)

- **Route:** `idquery` present + upstream 200 → 307 `Location` is the topic `login_url`;
  `idquery` is forwarded to the upstream call; missing/empty `idquery` → home (today's
  behavior); auth cookie still required; all failure modes → home; `idquery` validated +
  encoded (no open-redirect / injection).
- **Mapping:** `idQuery` from upstream survives onto `CeoIssue`; absent → undefined, no crash.
- **Modal:** issue **with** `idQuery` renders the "View in Nexorus" anchor
  (`target="_blank"`, `rel="noopener"`, `href` with encoded `idquery`); issue **without**
  `idQuery` renders no button.

## Two contract details to verify at build (both degrade to home if wrong)

1. **Upstream field name** — client called it `idQuery`; the example URL param is `idquery`.
   Confirm the real JSON key against a live `topics` payload before finalizing the mapping.
2. **Autologin param name** — assumed `autologin_generate` accepts `idquery` directly (per
   "it's based on the idquery"). Confirm the param name / mechanism against the live
   autologin response.

## Governance

- `api_key` stays server-side, never logged (AC4 preserved).
- The route now accepts **exactly one** client param, `idquery`, strictly validated
  (allowlisted charset) — it still cannot be repointed as an open proxy or open redirect.
- Session-gated per AC5 (unchanged).
- Degradation: any failure or bad `idquery` → Nexorus/OpenGate home, never a dead end.
- No LLM call → no cost-ledger impact.
