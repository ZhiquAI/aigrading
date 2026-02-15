#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

OUTPUT_DIR="${OUTPUT_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${OUTPUT_DIR}/grading_v2_${TIMESTAMP}.sql.gz"

mkdir -p "${OUTPUT_DIR}"

echo "Creating backup to ${OUTPUT_FILE}"
pg_dump "${DATABASE_URL}" | gzip > "${OUTPUT_FILE}"
echo "Backup completed"
