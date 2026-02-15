#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PREVIOUS_IMAGE_TAG:-}" ]]; then
  echo "PREVIOUS_IMAGE_TAG is required"
  exit 1
fi

if [[ -z "${DEPLOY_TARGET:-}" ]]; then
  echo "DEPLOY_TARGET is required"
  exit 1
fi

echo "Rolling back ${DEPLOY_TARGET} to image tag ${PREVIOUS_IMAGE_TAG}"
echo "1) pull old image"
echo "2) stop current container"
echo "3) start container with ${PREVIOUS_IMAGE_TAG}"
echo "4) verify /api/health"

# Template script only. Replace echo lines with your deployment command set.
