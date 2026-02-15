# Phase 4 - Extension Bridge & Dual-Platform Regression

## Delivered

- `extension-bridge` protocol constants and adapter registry are in place:
  - `PAGE_CONTEXT_REQUEST/RESPONSE`
  - `GRADE_APPLY_REQUEST/RESPONSE`
  - `RUBRIC_DETECT_REQUEST/RESPONSE`
- Platform adapters implemented:
  - `platform-zhixue-adapter`
  - `platform-haofenshu-adapter`
- Extension app feature structure migrated to:
  - `src/app-shell`
  - `src/features/*`
  - `src/store/useRootStore.ts`
- Extension app naming debt closed in source code:
  - `apps/extension-app/src/**` class prefix unified from `legacy-*` to `classic-*`
  - active-view localStorage keeps backward-compatible key reads (`legacy` -> `classic` -> current)

## In Progress

- Dual-platform full manual execution (requires live accounts and real grading pages).
- Tracking docs:
  - `docs/migration/phase-4-dual-platform-e2e-checklist.md`
  - `docs/migration/phase-4-dual-platform-e2e-report.md`

## Acceptance Checklist

- [x] bridge message protocol unified
- [x] dual adapter structure available
- [x] extension UI naming debt closed
- [ ] zhixue full regression passed
- [ ] haofenshu full regression passed
- [x] old chain toggle freeze window documented

## Freeze Window & Rollback Plan

### Freeze Window

- Freeze target: old chain routing/toggle logic in `extension-app` and `extension-bridge`.
- Freeze period: after dual-platform regression pass and before release tag creation.
- Freeze rule: no functional changes on old chain during freeze; only P0 fixes with explicit incident link.

### Rollback Steps

1. Roll back extension package to last stable release tag.
2. Restore previous `extension-bridge` adapter bundle (same tag).
3. Confirm `api/v2` health checks and sidepanel startup.
4. Run smoke flow on both platforms:
   - detect question
   - apply score
   - persist record
5. If smoke fails, revert to previous release tag and re-open freeze gate.
