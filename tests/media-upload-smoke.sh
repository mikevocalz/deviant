#!/bin/bash
# ============================================================
# MEDIA UPLOAD SMOKE TESTS (Supabase Edge Function)
# ============================================================
# Usage: ./tests/media-upload-smoke.sh
# With auth: SUPABASE_JWT=your_token ./tests/media-upload-smoke.sh
#
# Tests the media-upload Edge Function end-to-end
# ============================================================

# Load from environment - SUPABASE_URL and BUNNY_CDN_URL must be set in .env or environment
SUPABASE_URL="${SUPABASE_URL:-$EXPO_PUBLIC_SUPABASE_URL}"
BUNNY_CDN_URL="${BUNNY_CDN_URL:-$EXPO_PUBLIC_BUNNY_CDN_URL}"

if [ -z "$SUPABASE_URL" ]; then
  echo "ERROR: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL must be set"
  exit 1
fi

echo "============================================================"
echo "MEDIA UPLOAD SMOKE TESTS"
echo "============================================================"
echo "Supabase: $SUPABASE_URL"
echo "Bunny CDN: $BUNNY_CDN_URL"
echo "Time: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { 
  echo -e "${GREEN}✓ PASS${NC}: $1"
  ((PASS_COUNT++))
}
fail() { 
  echo -e "${RED}✗ FAIL${NC}: $1"
  ((FAIL_COUNT++))
}
warn() { 
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
  ((WARN_COUNT++))
}
section() {
  echo ""
  echo -e "${BLUE}--- $1 ---${NC}"
}

# ============================================================
# SECTION 1: EDGE FUNCTION AVAILABILITY
# ============================================================
section "EDGE FUNCTION AVAILABILITY"

# Test: Edge function responds (OPTIONS for CORS)
CORS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$SUPABASE_URL/functions/v1/media-upload")
if [ "$CORS_CODE" = "204" ] || [ "$CORS_CODE" = "200" ]; then
  pass "OPTIONS /functions/v1/media-upload (HTTP $CORS_CODE)"
else
  fail "OPTIONS /functions/v1/media-upload (HTTP $CORS_CODE)"
fi

# Test: Unauthorized request returns 401
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "Content-Type: application/octet-stream")
if [ "$UNAUTH_CODE" = "401" ]; then
  pass "POST without auth returns 401 (HTTP $UNAUTH_CODE)"
else
  fail "POST without auth should return 401 (HTTP $UNAUTH_CODE)"
fi

# ============================================================
# SECTION 2: AUTHENTICATED TESTS
# ============================================================
section "AUTHENTICATED TESTS"

if [ -z "$SUPABASE_JWT" ]; then
  warn "SUPABASE_JWT not set - skipping authenticated tests"
  echo ""
  echo "To run authenticated tests:"
  echo "  1. Get a JWT from Supabase Auth"
  echo "  2. Run: SUPABASE_JWT=your_token ./tests/media-upload-smoke.sh"
  echo ""
  echo "============================================================"
  echo "RESULTS: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
  echo "============================================================"
  if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
  fi
  exit 0
fi

AUTH_HEADER="Authorization: Bearer $SUPABASE_JWT"
# ANON_KEY should be set via environment variable or .env file
ANON_KEY="${SUPABASE_ANON_KEY:-$EXPO_PUBLIC_SUPABASE_ANON_KEY}"

# Test: Missing kind header returns 400
MISSING_KIND_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  -H "x-file-name: test.jpg" \
  -H "x-mime: image/jpeg" \
  --data-binary "test")
if [ "$MISSING_KIND_CODE" = "400" ]; then
  pass "Missing x-kind returns 400 (HTTP $MISSING_KIND_CODE)"
else
  fail "Missing x-kind should return 400 (HTTP $MISSING_KIND_CODE)"
fi

# Test: Invalid kind returns 400
INVALID_KIND_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  -H "x-kind: invalid-kind" \
  -H "x-file-name: test.jpg" \
  -H "x-mime: image/jpeg" \
  --data-binary "test")
if [ "$INVALID_KIND_CODE" = "400" ]; then
  pass "Invalid kind returns 400 (HTTP $INVALID_KIND_CODE)"
else
  fail "Invalid kind should return 400 (HTTP $INVALID_KIND_CODE)"
fi

# Test: Invalid mime type returns 415
INVALID_MIME_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  -H "x-kind: avatar" \
  -H "x-file-name: test.exe" \
  -H "x-mime: application/x-executable" \
  --data-binary "test")
if [ "$INVALID_MIME_CODE" = "415" ]; then
  pass "Invalid mime returns 415 (HTTP $INVALID_MIME_CODE)"
else
  fail "Invalid mime should return 415 (HTTP $INVALID_MIME_CODE)"
fi

# Test: Video without duration returns 400
VIDEO_NO_DURATION_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  -H "x-kind: post-video" \
  -H "x-file-name: test.mp4" \
  -H "x-mime: video/mp4" \
  --data-binary "test")
if [ "$VIDEO_NO_DURATION_CODE" = "400" ]; then
  pass "Video without duration returns 400 (HTTP $VIDEO_NO_DURATION_CODE)"
else
  fail "Video without duration should return 400 (HTTP $VIDEO_NO_DURATION_CODE)"
fi

# Test: Video over 60s returns 400
VIDEO_LONG_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  -H "x-kind: post-video" \
  -H "x-file-name: test.mp4" \
  -H "x-mime: video/mp4" \
  -H "x-duration-sec: 120" \
  --data-binary "test")
if [ "$VIDEO_LONG_CODE" = "400" ]; then
  pass "Video >60s returns 400 (HTTP $VIDEO_LONG_CODE)"
else
  fail "Video >60s should return 400 (HTTP $VIDEO_LONG_CODE)"
fi

# ============================================================
# SECTION 3: ACTUAL UPLOAD TEST
# ============================================================
section "ACTUAL UPLOAD TEST"

# Create a small test image (1x1 red pixel PNG)
TEST_IMAGE=$(echo -n "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==" | base64 -d)

# Upload test image
echo "Uploading test image..."
UPLOAD_RESP=$(curl -s -X POST "$SUPABASE_URL/functions/v1/media-upload" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/octet-stream" \
  -H "x-kind: avatar" \
  -H "x-file-name: test.png" \
  -H "x-mime: image/png" \
  --data-binary "$TEST_IMAGE")

echo "Response: $UPLOAD_RESP"

# Check if upload succeeded
if echo "$UPLOAD_RESP" | grep -q '"ok":true'; then
  pass "Image upload succeeded"
  
  # Extract URL from response
  MEDIA_URL=$(echo "$UPLOAD_RESP" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
  MEDIA_ID=$(echo "$UPLOAD_RESP" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  
  echo "  Media ID: $MEDIA_ID"
  echo "  Media URL: $MEDIA_URL"
  
  # Verify file exists on CDN
  if [ -n "$MEDIA_URL" ]; then
    CDN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -I "$MEDIA_URL")
    if [ "$CDN_CODE" = "200" ]; then
      pass "File accessible on CDN (HTTP $CDN_CODE)"
    else
      fail "File not accessible on CDN (HTTP $CDN_CODE)"
    fi
  fi
else
  ERROR=$(echo "$UPLOAD_RESP" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
  fail "Image upload failed: $ERROR"
fi

# ============================================================
# RESULTS
# ============================================================
echo ""
echo "============================================================"
echo "RESULTS: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "============================================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}SMOKE TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}SMOKE TESTS PASSED${NC}"
  exit 0
fi
