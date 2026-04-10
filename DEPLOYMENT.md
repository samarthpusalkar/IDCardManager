# Deployment Guide

## Runtime Model

Both deployment modes use the same process coordinator (`scripts/runtime-orchestrator.mjs`):
- Docker wrapper: `npm run runtime:docker`
- Standalone wrapper: `./start_card_management_system.sh`

Only the wrapper differs. Data and encryption behavior are unchanged across modes.

## Docker Mode

```bash
docker build -t card-management .
docker compose up -d
```

Persistence is deterministic:
- Host base path: `${HOST_DATA_DIR:-./data}`
- Container base path: `${DATA_ROOT:-/data}`
- Effective app storage path: `DATA_ROOT/CardManager/data`
- Final host location: `./data/CardManager/data`

## Standalone Mode

```bash
./start_card_management_system.sh
```

This starts both services in one coordinated flow:
- Backend database/API server on `9902`
- Main website server (Vite) on `9901`

Press `CTRL+C` once to stop both.

## Security Model

Encrypted storage behavior is unchanged in both modes:
- SQLite and uploaded blobs remain under `DATA_ROOT/CardManager/data`
- Upload payloads remain opaque encrypted bytes
- Startup wrappers only set ports/data-root and delegate to the shared runtime

If you override Docker env, keep both values aligned:
- `HOST_DATA_DIR` (host mount base)
- `DATA_ROOT` (container mount base)

## Backup

```bash
tar -czf cardmanbackup-$(date +%Y%m%d).tar.gz ./data/CardManager/data
```
