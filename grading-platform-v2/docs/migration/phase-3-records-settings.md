# Phase 3 - Records & Settings Milestone

## Delivered

- Kept records and settings on `api/v2` only:
  - `GET/POST/DELETE /api/v2/records`
  - `POST /api/v2/records/batch`
  - `DELETE /api/v2/records/:id`
  - `GET/PUT/DELETE /api/v2/settings`
- Added shared pagination validator:
  - `src/shared/validators/pagination.ts`
- Unified request id extraction via shared middleware:
  - `src/shared/middleware/request-context.ts`
- Completed backend shared scope resolver split:
  - `src/shared/scope-resolver/request-scope.ts`
  - `src/lib/request-scope.ts` now acts as compatibility re-export.
- Extended Prisma schema for architecture parity:
  - `RubricTemplate`
  - `GradingRecordItem`

## In Progress

- None.

## Acceptance Checklist

- [x] records routes fully on v2 APIs
- [x] settings routes fully on v2 APIs
- [x] request id is normalized across v2 routes
- [x] route-level error shaping fully converged on shared helper
- [x] extension UI naming cleanup finished
