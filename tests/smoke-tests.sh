#!/bin/bash
# SEV-0 Regression Smoke Tests
# Run these CURL commands to verify API endpoints are working
# Usage: ./tests/smoke-tests.sh

API_URL="https://payload-cms-setup-gray.vercel.app"
AUTH_URL="https://server-zeta-lovat.vercel.app"

echo "=== SEV-0 SMOKE TESTS ==="
echo "API: $API_URL"
echo "Auth: $AUTH_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; }

# Test 1: Health check
echo "--- Test 1: API Health ---"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/posts?limit=1")
if [ "$HEALTH" = "200" ]; then
  pass "API responding (HTTP $HEALTH)"
else
  fail "API not responding (HTTP $HEALTH)"
fi

# Test 2: Posts endpoint with depth
echo "--- Test 2: Posts with depth=2 ---"
POSTS=$(curl -s "$API_URL/api/posts?limit=1&depth=2")
if echo "$POSTS" | grep -q '"docs"'; then
  pass "Posts endpoint returns docs array"
  # Check if author has avatar populated
  if echo "$POSTS" | grep -q '"avatar"'; then
    pass "Author avatar field present"
  else
    warn "Author avatar field may not be populated"
  fi
else
  fail "Posts endpoint failed"
fi

# Test 3: Users endpoint
echo "--- Test 3: Users endpoint ---"
USERS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/users?limit=1")
if [ "$USERS" = "200" ]; then
  pass "Users endpoint responding"
else
  fail "Users endpoint failed (HTTP $USERS)"
fi

# Test 4: Events endpoint with depth
echo "--- Test 4: Events with depth=2 ---"
EVENTS=$(curl -s "$API_URL/api/events?limit=1&depth=2")
if echo "$EVENTS" | grep -q '"docs"'; then
  pass "Events endpoint returns docs array"
else
  fail "Events endpoint failed"
fi

# Test 5: Comments endpoint (requires postId in production, check general availability)
echo "--- Test 5: Comments endpoint ---"
COMMENTS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/comments?limit=1&depth=2")
if [ "$COMMENTS" = "200" ]; then
  pass "Comments endpoint responding"
elif [ "$COMMENTS" = "400" ]; then
  warn "Comments endpoint requires postId parameter (expected behavior)"
else
  fail "Comments endpoint failed (HTTP $COMMENTS)"
fi

# Test 6: Stories endpoint
echo "--- Test 6: Stories endpoint ---"
STORIES=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/stories?limit=1&depth=2")
if [ "$STORIES" = "200" ]; then
  pass "Stories endpoint responding"
else
  fail "Stories endpoint failed (HTTP $STORIES)"
fi

# Test 7: Notifications endpoint (requires auth)
echo "--- Test 7: Notifications endpoint ---"
NOTIF=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/notifications?limit=1")
if [ "$NOTIF" = "200" ] || [ "$NOTIF" = "401" ]; then
  pass "Notifications endpoint responding (HTTP $NOTIF - auth may be required)"
else
  fail "Notifications endpoint failed (HTTP $NOTIF)"
fi

# Test 8: Bookmarks endpoint (requires auth)
echo "--- Test 8: Bookmarks endpoint ---"
BOOKMARKS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/bookmarks?limit=1")
if [ "$BOOKMARKS" = "200" ] || [ "$BOOKMARKS" = "401" ]; then
  pass "Bookmarks endpoint responding (HTTP $BOOKMARKS - auth may be required)"
else
  fail "Bookmarks endpoint failed (HTTP $BOOKMARKS)"
fi

echo ""
echo "=== SMOKE TESTS COMPLETE ==="
echo "For authenticated tests, use the app or add Bearer token to requests"
