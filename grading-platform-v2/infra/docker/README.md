# Docker

This folder contains baseline runtime templates for local deployment and smoke checks.

## Files

- `Dockerfile.api-server`: Build `apps/api-server` production image.
- `docker-compose.api-server.yml`: Local compose stack (`api-server + postgres + redis`).

## Usage

```bash
cd infra/docker
docker compose -f docker-compose.api-server.yml up --build
```
