# Versioning Policy

MotionAI follows a pragmatic semver-like scheme:

**MAJOR** — breaking changes to persistence schema, API contracts, or
             production deployment requirements.

**MINOR** — new features, new API endpoints, feature flag additions.
             Backward-compatible with existing workspaces.

**PATCH** — bug fixes, performance improvements, dependency updates.
             No breaking changes.

## Current version

`v0.1.0` — initial public release. All APIs and schemas are subject to change
until v1.0.0.

## Version bumps

- Bump `version` in `package.json` and `src-tauri/Cargo.toml`.
- Tag the release commit: `git tag v<version>`.
- Generate changelog: `./scripts/generate-changelog.sh`.
- Create a GitHub Release with the changelog and build artifacts.

## Schema versioning

Workspace schema version is tracked independently via `WORKSPACE_SCHEMA_VERSION`
in `src/lib/workspaceSchema.ts`. See `docs/WORKSPACE_SCHEMA.md` for migration
policy.
