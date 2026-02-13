# Phase 1 - License Activation Milestone

## Delivered

- Added Prisma models:
  - `LicenseCode`
  - `LicenseBinding` (`@@unique([code, deviceId])`)
  - `ScopeQuota`
  - `IdempotencyRecord`
- Added `POST /api/v2/licenses/activate`
  - validates code/device
  - checks enabled/expired/device-limit
  - supports `idempotency-key`
- Upgraded `GET /api/v2/licenses/status`
  - reads real status from DB and binding records
- Added compatibility route:
  - `POST /api/activation/verify` (legacy request/response shape)
  - `GET /api/activation/verify` (legacy status shape)
- Added compatibility routes:
  - `GET/PUT/DELETE /api/sync/config` -> scope-based setting storage
  - `GET/POST/DELETE /api/sync/records` -> scope-based records storage
- Added Prisma model:
  - `RubricDocument` (`@@unique([scopeKey, questionKey])`)
- Added v2 resources:
  - `GET/PUT/DELETE /api/v2/settings`
  - `GET/POST/DELETE /api/v2/records`
  - `GET/POST/DELETE /api/v2/rubrics`
  - `POST /api/v2/rubrics/generate`
  - `POST /api/v2/rubrics/standardize`
  - `GET/POST /api/v2/gradings/evaluate`
  - `GET/POST /api/v2/exams`
- Added compatibility routes:
  - `GET/POST/DELETE /api/rubric`
  - `POST /api/ai/rubric`
  - `GET/POST /api/ai/grade`
  - `GET/POST /api/exams`
- Added seed data for test activation codes.
- Added integration tests covering v2 and legacy license/settings/records/rubric/grading routes.

## Local Runbook

```bash
cd apps/api-server
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

## Acceptance Checklist

- [ ] Activate code succeeds on first device
- [ ] Re-activate on same device is idempotent
- [ ] Device limit blocks activation with clear error
- [ ] Disabled or expired code returns proper status
- [ ] `status` endpoint reflects DB truth
- [x] Legacy route compatibility is verified in CI tests
- [x] Rubric and grading compatibility routes are verified
