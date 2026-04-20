# Go version tracking in CI: go-version-file vs pinned string

> In the context of upgrading pgx/v5 to v5.9.0 (which bumped go.mod to Go 1.25), facing the choice of how CI tracks the Go version, I decided to use `go-version-file: backend/go.mod` to achieve single-source-of-truth version tracking, accepting that CI always uses the minimum version declared in go.mod.

## Context

pgx/v5 v5.9.0 requires Go 1.25. The CI workflows had `go-version: "1.24"` hardcoded. Every Go module bump that raises the minimum version would require a matching manual update to both `ci.yml` and `security.yml`.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Hardcode `go-version: "1.25"` | Explicit, predictable | Must be manually updated each Go bump; two files to keep in sync with go.mod |
| `go-version-file: backend/go.mod` | go.mod is the single source of truth; CI auto-tracks module minimum | CI always uses the go.mod minimum, not necessarily latest patch |
| `go-version: "stable"` | Always latest stable Go | Non-deterministic; could break on unexpected Go releases |

## Decision

Chosen: **`go-version-file: backend/go.mod`**, because it eliminates the dual-maintenance problem. When a dependency bumps the minimum Go version in go.mod, CI inherits it automatically. This matches the `actions/setup-go` recommended pattern.

## Consequences

- go.mod is the canonical Go version spec; PR reviews catch unintended version bumps
- Removing the govulncheck `|| true` workaround becomes safe: Go 1.25 (now in go.mod) fixes the suppressed crypto/x509 CVEs (GO-2026-4947, GO-2026-4946)
- Future Go bumps in go.mod propagate to CI without extra workflow edits

## Artifacts

- Closes #20
- go.mod: `go 1.25.0`
- `.github/workflows/ci.yml`: two `go-version-file` replacements
- `.github/workflows/security.yml`: two `go-version-file` replacements + govulncheck unblocked
