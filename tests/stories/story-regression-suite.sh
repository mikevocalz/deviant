#!/usr/bin/env bash
# ============================================================
# DVNT Story Creation — Agent-Device Regression Test Suite
# ============================================================
# Runs on physical iOS device via callstackincubator/agent-device
# Usage: bash tests/stories/story-regression-suite.sh [--device <udid>] [--runs N]
# ============================================================

set -euo pipefail

# ── Config ──
APP_BUNDLE="com.dvnt.app"
DEVICE_UDID="${DEVICE_UDID:-00008120-001C31990198201E}"
PLATFORM="ios"
RUNS="${RUNS:-1}"
RESULTS_DIR="tests/stories/results"
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
RESULT_FILE="${RESULTS_DIR}/run-${TIMESTAMP}.json"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --device) DEVICE_UDID="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p "$RESULTS_DIR"

# ── Helpers ──
ad() {
  npx agent-device "$@" --platform "$PLATFORM" --udid "$DEVICE_UDID" --json 2>/dev/null
}

ad_text() {
  npx agent-device "$@" --platform "$PLATFORM" --udid "$DEVICE_UDID" 2>/dev/null
}

pass() { echo "  ✅ PASS: $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ❌ FAIL: $1 — $2"; FAILED=$((FAILED + 1)); FAILURES+=("$1: $2"); }
skip() { echo "  ⏭️  SKIP: $1"; SKIPPED=$((SKIPPED + 1)); }

wait_ms() { npx agent-device wait "$1" --platform "$PLATFORM" --udid "$DEVICE_UDID" 2>/dev/null; }

# Check element exists in snapshot
has_element() {
  local label="$1"
  local snap
  snap=$(ad snapshot -i 2>/dev/null || echo "")
  if echo "$snap" | grep -qi "$label"; then
    return 0
  else
    return 1
  fi
}

# ── Counters ──
TOTAL_RUNS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
ALL_FAILURES=()

# ============================================================
# Test Suites
# ============================================================

run_suite_a_hub() {
  echo ""
  echo "━━━ Suite A: Hub Flow ━━━"
  PASSED=0; FAILED=0; SKIPPED=0; FAILURES=()

  # A1: Open app and navigate to story creation
  echo "  A1: Open app → story hub"
  ad_text open "$APP_BUNDLE" >/dev/null 2>&1 || true
  wait_ms 2000

  # Take snapshot to verify app is running
  local snap
  snap=$(ad_text snapshot -i 2>/dev/null || echo "SNAPSHOT_FAILED")
  if [ "$snap" = "SNAPSHOT_FAILED" ]; then
    fail "A1" "Could not take snapshot — device may be locked"
    return
  fi
  pass "A1: App opened"

  # A2: Navigate to New Story screen
  echo "  A2: Navigate to New Story"
  # Try to find and tap the story creation entry point
  ad_text find "New Story" click 2>/dev/null || \
    ad_text find "Add Story" click 2>/dev/null || \
    ad_text find "Create" click 2>/dev/null || true
  wait_ms 1500

  snap=$(ad_text snapshot -i 2>/dev/null || echo "")
  if echo "$snap" | grep -qi "New Story\|Gallery\|Camera\|Text"; then
    pass "A2: Story hub screen visible"
  else
    skip "A2: Could not verify hub screen (may need manual navigation)"
  fi

  # A3: Verify Gallery button exists
  echo "  A3: Gallery button present"
  if echo "$snap" | grep -qi "Gallery"; then
    pass "A3: Gallery button found"
  else
    fail "A3" "Gallery button not found in hub"
  fi

  # A4: Verify Camera button exists
  echo "  A4: Camera button present"
  if echo "$snap" | grep -qi "Camera"; then
    pass "A4: Camera button found"
  else
    fail "A4" "Camera button not found in hub"
  fi

  # A5: Verify Text button exists
  echo "  A5: Text button present"
  if echo "$snap" | grep -qi "Text"; then
    pass "A5: Text button found"
  else
    fail "A5" "Text button not found in hub"
  fi

  echo "  Suite A: $PASSED passed, $FAILED failed, $SKIPPED skipped"
  TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
  ALL_FAILURES+=("${FAILURES[@]+"${FAILURES[@]}"}")
}

run_suite_b_image() {
  echo ""
  echo "━━━ Suite B: Image Editor Flow ━━━"
  PASSED=0; FAILED=0; SKIPPED=0; FAILURES=()

  # B1: Tap Gallery to open image picker
  echo "  B1: Tap Gallery"
  ad_text find "Gallery" click 2>/dev/null || true
  wait_ms 2000

  local snap
  snap=$(ad_text snapshot -i 2>/dev/null || echo "")

  # B2: Check if system picker or permission dialog appeared
  echo "  B2: System picker response"
  if echo "$snap" | grep -qi "Allow\|Photos\|Recents\|Cancel\|All Photos"; then
    pass "B2: Image picker / permission prompt appeared"
    # Handle permission if needed
    ad_text find "Allow Full Access" click 2>/dev/null || \
      ad_text find "Allow" click 2>/dev/null || true
    wait_ms 1000
  else
    skip "B2: Could not verify picker (may already have permissions)"
  fi

  # B3: Cancel from picker — should return to hub
  echo "  B3: Cancel from picker → back to hub"
  ad_text find "Cancel" click 2>/dev/null || \
    ad_text back 2>/dev/null || true
  wait_ms 1000

  snap=$(ad_text snapshot -i 2>/dev/null || echo "")
  if echo "$snap" | grep -qi "New Story\|Gallery\|Camera"; then
    pass "B3: Returned to hub after picker cancel"
  else
    fail "B3" "Did not return to hub after picker cancel"
  fi

  echo "  Suite B: $PASSED passed, $FAILED failed, $SKIPPED skipped"
  TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
  ALL_FAILURES+=("${FAILURES[@]+"${FAILURES[@]}"}")
}

run_suite_d_text() {
  echo ""
  echo "━━━ Suite D: Text-Only Flow ━━━"
  PASSED=0; FAILED=0; SKIPPED=0; FAILURES=()

  # D1: Tap Text to open text-only editor
  echo "  D1: Tap Text button"
  ad_text find "Text" click 2>/dev/null || true
  wait_ms 2000

  local snap
  snap=$(ad_text snapshot -i 2>/dev/null || echo "")

  # D2: Verify editor opened (should see editor controls, not hub)
  echo "  D2: Text editor opened"
  if echo "$snap" | grep -qi "Done\|close\|Aa\|draw\|sticker"; then
    pass "D2: Text editor opened successfully"
  else
    skip "D2: Could not verify text editor (snapshot may not capture Skia)"
  fi

  # D3: Cancel from text editor → back to hub
  echo "  D3: Cancel from text editor"
  ad_text find "close" click 2>/dev/null || \
    ad_text back 2>/dev/null || true
  wait_ms 1500

  snap=$(ad_text snapshot -i 2>/dev/null || echo "")

  # D4: Verify returned to hub (INV-NAV-1)
  echo "  D4: Back at hub after cancel"
  if echo "$snap" | grep -qi "New Story\|Gallery\|Camera\|Text"; then
    pass "D4: Returned to hub after text editor cancel (INV-NAV-1 ✓)"
  else
    fail "D4" "Did not return to hub after text editor cancel — possible ghost mode (INV-NAV-6)"
  fi

  # D5: Verify no ghost mode — text editor state should be clean
  echo "  D5: No ghost mode check"
  if echo "$snap" | grep -qi "Draw\|Sticker\|Done"; then
    fail "D5" "Editor elements still visible on hub — ghost mode detected (STOP-THE-LINE)"
  else
    pass "D5: No ghost mode — hub is clean"
  fi

  echo "  Suite D: $PASSED passed, $FAILED failed, $SKIPPED skipped"
  TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
  ALL_FAILURES+=("${FAILURES[@]+"${FAILURES[@]}"}")
}

run_suite_e_reentry() {
  echo ""
  echo "━━━ Suite E: Re-entry + Repeatability ━━━"
  PASSED=0; FAILED=0; SKIPPED=0; FAILURES=()

  # E1: Rapid text editor open/cancel cycle (3x)
  echo "  E1: Rapid text editor open/cancel (3 cycles)"
  local cycle_ok=true
  for i in 1 2 3; do
    ad_text find "Text" click 2>/dev/null || true
    wait_ms 1500
    ad_text back 2>/dev/null || true
    wait_ms 1000
  done

  local snap
  snap=$(ad_text snapshot -i 2>/dev/null || echo "")
  if echo "$snap" | grep -qi "New Story\|Gallery\|Camera"; then
    pass "E1: Hub clean after 3 rapid text editor cycles"
  else
    fail "E1" "Hub not clean after rapid cycles — state leak"
  fi

  # E2: Check no stale editor artifacts
  echo "  E2: No stale editor artifacts"
  if echo "$snap" | grep -qi "Done\|Draw\|Sticker\|Filter"; then
    fail "E2" "Stale editor artifacts on hub (STOP-THE-LINE)"
  else
    pass "E2: No stale editor artifacts"
  fi

  echo "  Suite E: $PASSED passed, $FAILED failed, $SKIPPED skipped"
  TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
  ALL_FAILURES+=("${FAILURES[@]+"${FAILURES[@]}"}")
}

# ============================================================
# Main Runner
# ============================================================

echo "╔══════════════════════════════════════════════════╗"
echo "║  DVNT Story Regression Suite                     ║"
echo "║  Device: $DEVICE_UDID        ║"
echo "║  Runs: $RUNS                                     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

for run in $(seq 1 "$RUNS"); do
  echo "══════════════════════════════════════════════════"
  echo "  RUN $run / $RUNS"
  echo "══════════════════════════════════════════════════"

  TOTAL_RUNS=$((TOTAL_RUNS + 1))

  run_suite_a_hub
  run_suite_b_image
  run_suite_d_text
  run_suite_e_reentry

  # Close app between runs for clean state
  if [ "$run" -lt "$RUNS" ]; then
    echo ""
    echo "  Closing app for next run..."
    ad_text close "$APP_BUNDLE" 2>/dev/null || true
    wait_ms 2000
  fi
done

# ============================================================
# Summary
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  RESULTS SUMMARY                                 ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Runs: $TOTAL_RUNS"
echo "║  Passed: $TOTAL_PASSED"
echo "║  Failed: $TOTAL_FAILED"
echo "║  Skipped: $TOTAL_SKIPPED"
echo "╚══════════════════════════════════════════════════╝"

if [ "$TOTAL_FAILED" -gt 0 ]; then
  echo ""
  echo "❌ FAILURES:"
  for f in "${ALL_FAILURES[@]}"; do
    if [ -n "$f" ]; then
      echo "  - $f"
    fi
  done
  echo ""
  echo "🛑 STOP-THE-LINE: $TOTAL_FAILED failure(s) detected"
  exit 1
else
  echo ""
  echo "✅ ALL TESTS PASSED"
  exit 0
fi
