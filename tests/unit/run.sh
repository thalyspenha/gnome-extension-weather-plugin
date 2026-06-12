#!/usr/bin/env bash
set -e
PASS=0
FAIL=0

shopt -s nullglob
for f in tests/unit/test-*.js; do
    echo "Running $f..."
    if gjs -m "$f"; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "Suites: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
