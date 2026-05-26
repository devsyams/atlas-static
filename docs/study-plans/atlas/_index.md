# ATLAS — Study-plan index

> Portfolio of all feature study plans for **Nexorus ATLAS** (MBG Crisis Dashboard), derived from
> `docs/superpowers/specs/2026-05-25-atlas-production-architecture-design.md`. One row per feature.
> Maintained per the SOP (`../README.md`). All plans start at **v1.0 / Planned**.

## Stages

`0-platform` · `1-watch` (ingestion) · `2-understand` (enrichment/analytics) · `3-act` (surfaces/assistant)

## Feature register

| ID | Feature | Stage | Sprint | Spec epic | Ver | Status |
|----|---------|-------|:------:|-----------|:---:|--------|
| **P1** | Monorepo foundation & tooling | 0-platform | S1 | E1 | 1.0 | Built |
| **P2** | DigitalOcean infrastructure & CI/CD | 0-platform | S1 | E1 | 1.0 | Planned |
| **P3** | Database schema, migrations & type generation | 0-platform | S1–S2 | E2 | 1.0 | Built |
| **P4** | Object storage (Spaces) integration | 0-platform | S2 | E2 | 1.0 | Planned |
| **P5** | Authentication — email/password + sessions | 0-platform | S2 | E3 | 1.0 | Built |
| **P6** | RBAC, route guards & audit log | 0-platform | S2 | E3 | 1.0 | Built |
| **P7** | Observability, hardening, backups & launch | 0-platform | S1,S6 | E8,E9 | 1.0 | Planned |
| **P8** | Multi-tenancy & per-tenant narration | 0-platform | S2–S3 | E2,E3 (ext) | 1.0 | Planned |
| **W1** | Source registry & scheduler | 1-watch | S3 | E4 | 1.0 | Planned |
| **W2** | RSS & news-API connectors | 1-watch | S3 | E4 | 1.0 | Planned |
| **W3** | Social connectors (X/IG/FB/TikTok) | 1-watch | S3–S4 | E4 | 1.0 | Planned |
| **W4** | Normalization, dedup & raw storage | 1-watch | S3 | E4 | 1.0 | Planned |
| **W5** | Initial recent-window backfill | 1-watch | S3 | E4 | 1.0 | Planned |
| **U1** | LLM provider abstraction & cost ledger | 2-understand | S4 | E5 | 1.0 | Planned |
| **U2** | Article enrichment (score/issues/sentiment/summary/keywords/embedding) | 2-understand | S4 | E5 | 2.0 | Planned |
| **U3** | Geocoding & incident mapping | 2-understand | S4 | E5 | 1.0 | Planned |
| **U4** | Crisis snapshots & trends | 2-understand | S4 | E5 | 1.0 | Planned |
| **U5** | Predictions, insights, actor & leadership analytics | 2-understand | S4–S5 | E5 | 1.0 | Planned |
| **U6** | Semantic search & embedding index (assistant RAG layer) | 2-understand | S4–S5 | E5 (ext) | 1.0 | Planned |
| **A1** | Dashboard read API & caching | 3-act | S2,S5 | E6 | 1.0 | Built |
| **A2** | Widget integration & live data | 3-act | S5 | E6 | 1.0 | Planned |
| **A3** | Persisted dashboard layout | 3-act | S5 | E6 | 1.0 | Planned |
| **A4** | AI assistant — copilot chat | 3-act | S5 | E7 | 1.0 | Planned |
| **A5** | AI assistant — briefing, forecast & per-widget ask | 3-act | S5 | E7 | 1.0 | Planned |
| **A6** | Real-time ticker, alerts & War Room | 3-act | S5–S6 | E8 | 1.0 | Planned |

**Totals:** 25 features · 8 platform · 5 watch · 6 understand · 6 act.

## Sprint → feature map (delivery view)

| Sprint | Window (2026) | Features (primary) |
|---|---|---|
| **S1** | Jun 1–12 | P1, P2, P3 (start), P7 (skeleton) |
| **S2** | Jun 15–26 | P3 (finish), P4, P5, P6, P8 (start), A1 (initial) · **M1: DB-backed dashboard** |
| **S3** | Jun 29–Jul 10 | W1, W2, W4, W5, W3 (spike), P8 (finish) |
| **S4** | Jul 13–24 | U1, U2 (v2.0 incl. embeddings), U3, U4, U6 (start), W3 (cont.) · **M2: live enrichment** |
| **S5** | Jul 27–Aug 7 | U5, U6 (finish), A1 (finish), A2, A3, A4, A5, A6 (start) · **M3: feature-complete** |
| **S6** | Aug 10–21 | A6 (finish), P7 (hardening/launch) · **M4: production launch** |

## Index revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial register: 22 features derived from the architecture spec |
| 1.1 | 2026-05-25 | Added W5 (initial recent-window backfill) after the light-backfill decision; 22→23 features |
| 1.2 | 2026-05-26 | Added P8 (multi-tenancy & per-tenant narration) after multi-client scope expansion; 23→24 features; sprint map updated (P8 in S2–S3) |
| 1.3 | 2026-05-26 | Added U6 (semantic search & embedding index) for assistant RAG layer; bumped U2 to v2.0 (embedding-generation AC added); 24→25 features; sprint map updated (U6 in S4–S5) |
