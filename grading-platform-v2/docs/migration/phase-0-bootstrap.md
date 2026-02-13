# Phase 0 Bootstrap Checklist

## Completed

- [x] Initialized `pnpm + turbo` monorepo skeleton
- [x] Created workspace apps and packages structure
- [x] Added shared TypeScript strict config
- [x] Added `api-contracts` with base `ScopeIdentity` schema
- [x] Added `domain-core` with scope resolver
- [x] Added `api-server` with `/api/health` and `/api/v2/licenses/status`

## Next

- [x] Add CI workflow for `pnpm lint && pnpm typecheck && pnpm build`
- [x] Add `api/v2/licenses/activate`
- [x] Add database schema for `LicenseCode` and `LicenseBinding`
- [x] Add basic unit tests for scope resolver and contracts
- [x] Add integration tests for license routes
- [x] Implement compatibility forwarding from legacy endpoints to `api/v2/licenses/*`
- [x] Add compatibility forwarding for `/api/sync/config` and `/api/sync/records`
