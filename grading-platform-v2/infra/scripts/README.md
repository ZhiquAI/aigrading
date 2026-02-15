# Infra Scripts

Operational helper scripts for backup and rollback baseline.

## Files

- `backup-db.sh`: Create PostgreSQL dump.
- `restore-db.sh`: Restore dump to target DB.
- `rollback-release.sh`: Rollback runtime to previous image tag.
- `check-phase4-regression-gate.sh`: Block release when Phase 4 dual-platform regression report is still pending.

## Notes

- Scripts are templates and require environment variables before production usage.
- Keep credentials in runtime env, never hard-code in scripts.
- Phase 4 gate command:
  - `pnpm check:phase4-gate`
