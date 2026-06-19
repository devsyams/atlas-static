# CI/CD: auto build → DOCR → ArgoCD deploy (danantara)

**Date:** 2026-06-18
**Status:** Approved (design)
**Scope:** `atlas-static` repo — add a GitHub Actions workflow that ships every
merge to `main` to the cluster via the existing ArgoCD GitOps flow.

## Background

`atlas-static` is deployed to the `atlas-cluster` DOKS cluster by ArgoCD. The
`atlas-infra` repo onboards it as an ApplicationSet named `danantara` whose
git-directory generator watches `k8s/overlay/*` on `main` of
`github.com/devsyams/atlas-static.git`. ArgoCD applies the `k8s/overlay/prod`
overlay into namespace `danantara-prod`.

Today the image tag is bumped **by hand**: an engineer builds the image, pushes
it to DOCR, edits `k8s/overlay/prod/kustomization.yaml` (`images[].newTag`), and
commits. We automate that loop so a merge to `main` deploys itself.

### Acceptance criteria

- **Given** a PR is merged to `main` that changes app code, **when** the merge
  push lands, **then** a new image is built and pushed to DOCR tagged with the
  commit's short SHA (and `latest`).
- **Given** the image is pushed, **when** the workflow finishes, **then**
  `k8s/overlay/prod/kustomization.yaml` `newTag` equals `sha-<short>` and is
  committed back to `main`.
- **Given** the manifest bump is committed, **then** ArgoCD picks up the change
  and rolls `danantara-prod` to the new image.
- **Given** the workflow's own manifest commit, **then** it does **not** trigger
  another build (no infinite loop).

## Design

### Trigger

```yaml
on:
  push:
    branches: [main]
    paths-ignore: ['k8s/**', 'docs/**', '**.md', '.github/**']
```

A merge to `main` is a push to `main`. `paths-ignore` ensures the bot's own
manifest commit (touches only `k8s/**`) and doc-only edits do not build. A
`concurrency` group cancels superseded runs.

### Pipeline (single job, `ubuntu-latest`)

1. **Checkout** `main` with `permissions: contents: write` (to push back).
2. **Tag** = `sha-${GITHUB_SHA:0:7}` (immutable, unique per merge → guarantees
   ArgoCD sees a diff and redeploys; traceable to the commit).
3. **doctl login** via `digitalocean/action-doctl` + secret
   `DIGITALOCEAN_ACCESS_TOKEN`; `doctl registry login`.
4. **Build & push** with Buildx + GHA cache to
   `registry.digitalocean.com/nexorus-registry/danantara:{sha-<short>, latest}`.
5. **Bump overlay** — `kustomize edit set image` in `k8s/overlay/prod` so
   `newTag` becomes the new SHA tag.
6. **Commit & push back** to `main` as `github-actions[bot]` with message
   `chore(deploy): danantara image -> sha-<short> [skip ci]`.

### Why `k8s/overlay/prod`, not `k8s/base`

The tag ArgoCD actually applies lives in `k8s/overlay/prod/kustomization.yaml`
(`images[].newTag`). `k8s/base/deployment.yaml` keeps `:latest` as a placeholder
(standard kustomize pattern). CI updates the **overlay**, which already exists;
`base` is left untouched.

### Loop prevention (defence in depth)

- Commits made with the default `GITHUB_TOKEN` do not trigger workflows.
- `paths-ignore: ['k8s/**', ...]` — the bump touches only `k8s/**`.
- `[skip ci]` in the commit message.

### Prerequisite (out of band)

Repo secret **`DIGITALOCEAN_ACCESS_TOKEN`** — a DO API token with container
registry read/write. Set once via `gh secret set` or the repo Settings UI.

## Out of scope (YAGNI)

- Test/lint gating inside the deploy workflow (assumed run on the PR before
  merge).
- `dev`/`test` overlays (only `prod` exists today).
- PR-based manifest bump (`main` is unprotected; direct push is requested).
