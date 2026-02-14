# Extension App V2 API Mapping

This document locks the extension front-end contract to v2 endpoints.

## Scope and identity headers

All business requests send:

- `x-device-id`
- optional `x-activation-code`

## Module to API mapping

| Module | Action | Method | Endpoint |
|---|---|---|---|
| Health | health check | GET | `/api/health` |
| License | status | GET | `/api/v2/licenses/status` |
| License | activate | POST | `/api/v2/licenses/activate` |
| Settings | get by key | GET | `/api/v2/settings?key=...` |
| Settings | list all | GET | `/api/v2/settings` |
| Settings | upsert | PUT | `/api/v2/settings` |
| Settings | delete | DELETE | `/api/v2/settings?key=...` |
| Exams | list | GET | `/api/v2/exams` |
| Exams | create | POST | `/api/v2/exams` |
| Rubrics | list | GET | `/api/v2/rubrics` |
| Rubrics | detail by questionKey | GET | `/api/v2/rubrics?questionKey=...` |
| Rubrics | upsert | POST | `/api/v2/rubrics` |
| Rubrics | delete | DELETE | `/api/v2/rubrics?questionKey=...` |
| Rubrics | generate | POST | `/api/v2/rubrics/generate` |
| Rubrics | standardize | POST | `/api/v2/rubrics/standardize` |
| Grading | quota status | GET | `/api/v2/gradings/evaluate` |
| Grading | evaluate | POST | `/api/v2/gradings/evaluate` |
| Records | list | GET | `/api/v2/records` |
| Records | create batch | POST | `/api/v2/records/batch` |
| Records | delete by id | DELETE | `/api/v2/records/:id` |
| Records | delete by filter | DELETE | `/api/v2/records?questionNo=...&questionKey=...` |

## Guardrails

- No new legacy endpoint usage in `apps/extension-app`.
- New features must first reuse this API map and current DTO types in `src/lib/api.ts`.
- Contract changes require synchronized updates in:
  - `apps/extension-app/src/lib/api.ts`
  - this API map file
