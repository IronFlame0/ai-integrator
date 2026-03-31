#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0
E2E=false

for arg in "$@"; do
  [[ "$arg" == "--e2e" ]] && E2E=true
done

run_suite() {
  local name="$1"
  local dir="$2"
  shift 2

  local output status
  output=$(cd "$dir" && "$@" 2>&1) && status=0 || status=$?

  if [[ $status -eq 0 ]]; then
    local summary
    summary=$(printf "%s" "$output" | grep -E "passed|test" | tail -1 || true)
    printf "✓ %-12s  %s\n" "$name" "$summary"
  else
    printf "✗ %-12s  FAILED\n" "$name"
    printf "%s\n" "$output" | grep -E "^FAILED |^ERROR |AssertionError|assert |Error:" | head -30 | sed 's/^/  /'
    echo ""
    FAILED=$((FAILED + 1))
  fi
}

echo "Running tests..."
echo ""

run_suite "backend" "$ROOT/apps/api" \
  python -m pytest -q --tb=line --no-header

run_suite "frontend" "$ROOT/apps/frontend" \
  npx vitest run --reporter=dot

if $E2E; then
  run_suite "e2e" "$ROOT/apps/frontend" \
    npx playwright test
fi

echo ""
if [[ $FAILED -gt 0 ]]; then
  echo "✗ $FAILED suite(s) failed"
  exit 1
else
  echo "✓ All tests passed"
fi
