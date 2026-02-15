# Phase 4 - Dual Platform E2E Regression Report

## Report Summary

- Report date: 2026-02-15
- Owner: extension-app / extension-bridge
- Scope baseline: `docs/migration/phase-4-dual-platform-e2e-checklist.md`
- Overall status: `Pending Manual Run`
- Release gate:
  - `pnpm check:phase4-gate`
- Version baseline:
  - UI naming closeout commit: `b6b6cb1`
  - visual selector fix commit: `9cab022`

## Platform Status

| Platform | R1-R8 | Blocking Issue | Notes |
| --- | --- | --- | --- |
| 智学网（zhixue） | Pending | 需要真实账号与目标阅卷页面 | 待执行并补齐截图/日志 |
| 好分数（haofenshu） | Pending | 需要真实账号与目标阅卷页面 | 待执行并补齐截图/日志 |

## Scoreboard

| Platform | Passed | Failed | Pending | Pass Rate |
| --- | --- | --- | --- | --- |
| 智学网（zhixue） | 0 | 0 | 8 | 0% |
| 好分数（haofenshu） | 0 | 0 | 8 | 0% |
| Total | 0 | 0 | 16 | 0% |

## Completed in This Iteration

1. Extension 端 UI 命名债收口（`legacy-*` -> `classic-*`）。
2. 旧链路冻结窗口与回滚步骤文档化。
3. 回归清单矩阵（R1-R8）与执行模板就绪。
4. 视觉基线自动化用例通过（6/6）。

## Open Items

1. 双平台真实账号手工回归执行。
2. 失败用例缺陷登记与修复回归。
3. 证据归档（截图、request-id、错误日志片段）。

## Evidence Index (To Fill)

| Platform | Case ID | Evidence Type | Path/Link | Notes |
| --- | --- | --- | --- | --- |
| zhixue | R1 | screenshot/log |  |  |
| zhixue | R2 | screenshot/log |  |  |
| zhixue | R3 | screenshot/log |  |  |
| zhixue | R4 | screenshot/log |  |  |
| zhixue | R5 | screenshot/log |  |  |
| zhixue | R6 | screenshot/log |  |  |
| zhixue | R7 | screenshot/log |  |  |
| zhixue | R8 | screenshot/log |  |  |
| haofenshu | R1 | screenshot/log |  |  |
| haofenshu | R2 | screenshot/log |  |  |
| haofenshu | R3 | screenshot/log |  |  |
| haofenshu | R4 | screenshot/log |  |  |
| haofenshu | R5 | screenshot/log |  |  |
| haofenshu | R6 | screenshot/log |  |  |
| haofenshu | R7 | screenshot/log |  |  |
| haofenshu | R8 | screenshot/log |  |  |

## Release Recommendation

- 在双平台 R1-R8 全通过前，不建议进入 Phase 4 完结签收。
