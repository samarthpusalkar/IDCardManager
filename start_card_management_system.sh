#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

export DATA_ROOT="${DATA_ROOT:-$PWD/data}"
export PORT_API="${PORT_API:-9902}"
export PORT_APP="${PORT_APP:-9901}"
mkdir -p "$DATA_ROOT"

echo "Starting Card Management runtime (standalone mode)"
echo "DATA_ROOT=$DATA_ROOT"
echo "Backend: http://localhost:$PORT_API"
echo "Website: http://localhost:$PORT_APP"

npm run runtime:standalone
