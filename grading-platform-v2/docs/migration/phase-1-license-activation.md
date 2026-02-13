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
- Added Prisma model:
  - `RubricDocument` (`@@unique([scopeKey, questionKey])`)
- Added v2 resources:
  - `GET/PUT/DELETE /api/v2/settings`
  - `GET /api/v2/records`
  - `POST /api/v2/records/batch`
  - `DELETE /api/v2/records/:id`
  - `POST/DELETE /api/v2/records`
  - `GET/POST/DELETE /api/v2/rubrics`
  - `POST /api/v2/rubrics/generate`
  - `POST /api/v2/rubrics/standardize`
  - `GET/POST /api/v2/gradings/evaluate`
  - `GET/POST /api/v2/exams`
- Added seed data for test activation codes.
- Added integration tests covering v2 license/settings/records/rubric/grading routes.
- Removed legacy compatibility routes from `grading-platform-v2` to enforce v2-only API boundary.

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
- [x] v2-only routes are verified in CI tests
