# ATLAS — Study-plan index

> Portfolio of all feature study plans for **Nexorus ATLAS** (MBG Crisis Dashboard), derived from
> `docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`. One row per feature.
> Maintained per the SOP (`../README.md`). All plans start at **v1.0 / Planned**.

## Stages

`0-platform` · `1-watch` (ingestion) · `2-understand` (enrichment/analytics) · `3-act` (surfaces/assistant)

## Feature register

| ID | Feature | Stage | Sprint | Spec epic | Ver | Status |
|----|---------|-------|:------:|-----------|:---:|--------|
| **P1** | Monorepo foundation & tooling | 0-platform | S1 | E1 | 1.0 | Planned |
| **P2** | DigitalOcean infrastructure & CI/CD | 0-platform | S1 | E1 | 1.0 | Planned |
| **P3** | Database schema, migrations & type generation | 0-platform | S1–S2 | E2 | 1.0 | Planned |
| **P4** | Object storage (Spaces) integration | 0-platform | S2 | E2 | 1.0 | Planned |
| **P5** | Authentication — email/password + sessions | 0-platform | S2 | E3 | 1.0 | Planned |
| **P6** | RBAC, route guards & audit log | 0-platform | S2 | E3 | 1.0 | Planned |
| **P7** | Observability, hardening, backups & launch | 0-platform | S1,S6 | E8,E9 | 1.0 | Planned |
| **W1** | Source registry & scheduler | 1-watch | S3 | E4 | 1.0 | Planned |
| **W2** | RSS & news-API connectors | 1-watch | S3 | E4 | 1.0 | Planned |
| **W3** | Social connectors (X/IG/FB/TikTok) | 1-watch | S3–S4 | E4 | 1.0 | Planned |
| **W4** | Normalization, dedup & raw storage | 1-watch | S3 | E4 | 1.0 | Planned |
| **W5** | Initial recent-window backfill | 1-watch | S3 | E4 | 1.0 | Planned |
| **U1** | LLM provider abstraction & cost ledger | 2-understand | S4 | E5 | 1.0 | Planned |
| **U2** | Article enrichment (score/issues/sentiment/summary/keywords) | 2-understand | S4 | E5 | 1.0 | Planned |
| **U3** | Geocoding & incident mapping | 2-understand | S4 | E5 | 1.0 | Planned |
| **U4** | Crisis snapshots & trends | 2-understand | S4 | E5 | 1.0 | Planned |
| **U5** | Predictions, insights, actor & leadership analytics | 2-understand | S4–S5 | E5 | 1.0 | Planned |
| **A1** | Dashboard read API & caching | 3-act | S2,S5 | E6 | 1.0 | Planned |
| **A2** | Widget integration & live data | 3-act | S5 | E6 | 1.0 | Planned |
| **A3** | Persisted dashboard layout | 3-act | S5 | E6 | 1.0 | Planned |
| **A4** | AI assistant — copilot chat | 3-act | S5 | E7 | 1.0 | Planned |
| **A5** | AI assistant — briefing, forecast & per-widget ask | 3-act | S5 | E7 | 1.0 | Planned |
| **A6** | Real-time ticker, alerts & War Room | 3-act | S5–S6 | E8 | 1.0 | Planned |
| **A7** | Danantara CEO Command Wall (zero-click demo) | 3-act | demo | — | 23.0 | Built |

**Totals:** 24 features · 7 platform · 5 watch · 5 understand · 7 act.

## Sprint → feature map (delivery view)

| Sprint | Window (2026) | Features (primary) |
|---|---|---|
| **S1** | Jun 1–12 | P1, P2, P3 (start), P7 (skeleton) |
| **S2** | Jun 15–26 | P3 (finish), P4, P5, P6, A1 (initial) · **M1: DB-backed dashboard** |
| **S3** | Jun 29–Jul 10 | W1, W2, W4, W5, W3 (spike) |
| **S4** | Jul 13–24 | U1, U2, U3, U4, W3 (cont.) · **M2: live enrichment** |
| **S5** | Jul 27–Aug 7 | U5, A1 (finish), A2, A3, A4, A5, A6 (start) · **M3: feature-complete** |
| **S6** | Aug 10–21 | A6 (finish), P7 (hardening/launch) · **M4: production launch** |

## Index revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial register: 22 features derived from the architecture spec |
| 1.1 | 2026-05-25 | Added W5 (initial recent-window backfill) after the light-backfill decision; 22→23 features |
| 1.2 | 2026-06-02 | Added A7 (Danantara CEO Command Wall) from client CEO feedback; 23→24 features |
| 1.3 | 2026-06-03 | A7 → v2.0 In progress (rank-movement arrows + explicit pos/neg sentiment counts) |
| 1.4 | 2026-06-03 | A7 → v4.0 In progress (two-column sentiment-grouped wall + per-panel pie; spotlight/takeover removed) |
| 1.5 | 2026-06-03 | A7 → v5.0 In progress (per-item pie charts; positive/negative groups side by side) |
| 1.6 | 2026-06-03 | A7 → v6.0 In progress (AC15 readability type scale for 60-year-old CEO: 16px floor) |
| 1.7 | 2026-06-03 | A7 → v7.0 Built (topic rows drop sparkline + pie to trailing + full titles; BUMN single-list with leading positive/negative topic per row — AC16) |
| 1.8 | 2026-06-03 | A7 → v8.0 Built (topic board → single full-width list like BUMN, most-negative first + sentiment tint, pie kept; fixes messy multi-line titles; side-by-side topic sub-columns retired) |
| 1.9 | 2026-06-03 | A7 → v9.0 Built (restore side-by-side TOPIK POSITIF/NEGATIF columns; stacked row card keeps titles legible; pie + tint kept) |
| 1.10 | 2026-06-03 | A7 → v10.0 Built (mini pie per BUMN topic cell; net-score tooltip; tidied Isu Danantara pie/meta layout; shared pieTotals) |
| 1.11 | 2026-06-03 | A7 → v11.0 Built (BUMN board: remove net-score number, add sequential rank number, add per-topic reach + sentiment %) |
| 1.12 | 2026-06-03 | A7 → v12.0 Built (localize UI chrome to English; content/taxonomy stays Indonesian — AC17) |
| 1.13 | 2026-06-04 | A7 → v13.0 Built (topic rows drop velocity %; mini pie groups green/red % + donut; pie to right side) |
| 1.14 | 2026-06-04 | A7 → v14.0 Built (topic row: rank + title left, pie over reach right — client sketch) |
| 1.15 | 2026-06-04 | A7 → v15.0 Built (mini pie percentages flank the donut — value% · donut · value%) |
| 1.16 | 2026-06-04 | A7 → v16.0 Built (mini donut arcs reversed to match labels — green left, red right) |
| 1.17 | 2026-06-04 | A7 → v17.0 Built (drop neutral stay rank dash; rank numbers get trailing period; english rank tooltips) |
| 1.18 | 2026-06-04 | A7 → v18.0 Built (per-topic AI context line beneath each title — muted, clamped sneak peek) |
| 1.19 | 2026-06-04 | A7 → v19.0 Built (BUMN board mirrors Issues rows: logo + name + context + own pie/mentions; retire topic cells; + AC18) |
| 1.20 | 2026-06-04 | A7 → v20.0 Built (BUMN board → two-column SENTIMEN POSITIF/NEGATIF like Issues; sourced 12 real BUMN logos) |
| 1.21 | 2026-06-04 | A7 → v21.0 Built (bigger topic titles text-2xl; BUMN titled by nickname/ticker) |
| 1.22 | 2026-06-04 | A7 → v22.0 Built (BUMN row leads with its top issue as the 24px headline; ticker demoted to a small eyebrow) |
| 1.23 | 2026-06-04 | A7 → v23.0 Built (BUMN ticker moved under the logo as one identity block; headline-only text column) |
