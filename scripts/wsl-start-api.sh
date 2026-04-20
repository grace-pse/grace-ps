#!/usr/bin/env bash
# Kick off the API server in WSL, detached, writing logs to /tmp/server.log.
# Safe to re-run; kills any prior instance.
set -euo pipefail

PIDFILE=/tmp/server.pid
LOGFILE=/tmp/server.log

if [[ -f "$PIDFILE" ]]; then
  OLD_PID=$(cat "$PIDFILE" || true)
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo ">> killing previous server pid=$OLD_PID"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
fi

# Kill any stray pnpm/tsx listening on 3001
pkill -f 'tsx.*src/index.ts' 2>/dev/null || true
sleep 0.5

cd /root/csmp_v2
echo ">> launching pnpm --filter server dev (logs: $LOGFILE)"
nohup pnpm --filter server dev >"$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
sleep 1
echo ">> pid=$(cat $PIDFILE)"
echo "--- first 10 log lines after 1s ---"
head -20 "$LOGFILE" 2>/dev/null || echo "(log not yet flushed)"
