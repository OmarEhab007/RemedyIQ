# Fix push-triggered security jobs in security.yml

> In the context of security.yml firing on both `pull_request` and `push` events, facing two jobs that failed after every merge to main, I decided to restrict Semgrep to PR events only and fix TruffleHog's base/head refs for push events, accepting that Semgrep no longer runs a redundant post-merge scan.

## Context

After merging PRs the `Security Scan / Secrets Detection (push)` job failed with `unable to resolve ref: no base refs succeeded for base: 'main'`. The `Security Scan / Semgrep SAST (push)` job also failed with auth/rate-limit errors. Both run on `push` to main (post-merge) and on `pull_request`.

Root causes:
1. **TruffleHog**: `base: ${{ github.event.repository.default_branch }}` resolves to the string `"main"` on push events. After a squash-merge, `base: main` (branch tip) and `head: HEAD` point to the same commit — TruffleHog can't diff a commit against itself.
2. **Semgrep**: `returntocorp/semgrep-action@v1` is unreliable on push events without `SEMGREP_APP_TOKEN` and has no meaningful diff context post-merge (the code was already scanned in the PR).

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Restrict Semgrep to `pull_request` only | Eliminates the push failure; PR is the right place for diff-based SAST | No post-merge Semgrep scan (but CodeQL covers push-to-main) |
| Upgrade Semgrep action + keep both triggers | Keeps push coverage | Requires `SEMGREP_APP_TOKEN`; overlaps with CodeQL which already runs on push |
| TruffleHog: use `github.event.before` for push | Correct diff range (before-push SHA → new HEAD) | None — this is the documented correct approach |
| TruffleHog: restrict to PR only | Simpler | Misses secrets introduced via direct pushes to main |

## Decision

- **Semgrep**: Restrict to `pull_request` events. CodeQL already covers push-to-main for deep SAST analysis; Semgrep's value is in fast PR feedback, not post-merge reruns.
- **TruffleHog**: Keep both triggers but fix the refs — use `github.event.before` as `base` and `github.sha` as `head` on push events; skip initial-commit pushes (all-zeros `before` SHA).

## Consequences

- `Security Scan / Semgrep SAST` no longer runs on push to main (CodeQL is the push-time SAST gate)
- `Security Scan / Secrets Detection` passes after every squash-merge to main
- Introducing secrets via a direct push to main is still caught by TruffleHog
- Force-push events skip TruffleHog (`github.event.forced == true`); on a force-push the `event.before` SHA may not be reachable in the graph, which would cause a silent full-history scan or the same ref-resolution error — skipping is the safer default

## Artifacts

- Closes #25
- `.github/workflows/security.yml`: `semgrep` job adds `if: github.event_name == 'pull_request'`; `secrets` job adds `if:` guard + corrected `base`/`head` expressions
