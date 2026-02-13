# Phase 2 - AI Gateway Integration

## Delivered

- Upgraded `@ai-grading/ai-gateway` to real provider gateway mode:
  - OpenRouter + Zhipu provider clients
  - request timeout and structured JSON parsing
  - provider fallback chain (`openrouter -> zhipu`)
- Added gateway unit tests (`2` cases):
  - fallback to secondary provider
  - typed error on unavailable providers
- Integrated gateway into rubric generation:
  - `generateRubricDraft` now calls AI gateway first
  - auto fallback to rule-based rubric generator when provider call fails
- Integrated gateway into grading evaluation:
  - `evaluateGrading` now calls AI gateway first (supports image input)
  - auto fallback to rule-evaluator when provider call fails
- Added provider trace metadata in rubric/grading responses:
  - `providerTrace.mode` indicates `ai` or `fallback`
  - `providerTrace.reason/attempts` expose fallback reason and provider attempt chain
- Updated routes to pass through AI inputs:
  - `questionImage/answerImage` for rubric generation routes
  - `imageBase64` for grading evaluate routes
- Added env placeholders for AI providers in `apps/api-server/.env.example`.

## Notes

- Current fallback strategy prioritizes service continuity:
  - if provider credentials are missing or provider response is invalid, routes still return deterministic rule-based results.
- This phase intentionally keeps quota and record persistence behavior unchanged.

## Local Verification

```bash
cd grading-platform-v2
corepack pnpm install
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```
