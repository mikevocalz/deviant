#!/bin/bash
# Pre-deployment safety checks
# Run this before every `git push` or `eas update`

echo "🔍 Running pre-deployment safety checks..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# 1. TypeScript type check
echo "📘 Checking TypeScript types..."
TSC_OUTPUT=$(npx tsc --noEmit --skipLibCheck 2>&1)
TSC_EXIT=$?
# Filter out node_modules errors (only check project source files)
PROJECT_ERRORS=$(echo "$TSC_OUTPUT" | grep -v "node_modules" | grep -E "error TS|error:\s*" || true)
if [ -z "$PROJECT_ERRORS" ] && [ $TSC_EXIT -ne 0 ]; then
    echo -e "${YELLOW}⚠️  TypeScript errors only in node_modules (third-party library)${NC}"
    echo -e "${GREEN}✅ Project source files pass type check${NC}"
elif [ -z "$PROJECT_ERRORS" ]; then
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
else
    echo -e "${RED}❌ TypeScript errors found in project source:${NC}"
    echo "$PROJECT_ERRORS"
    FAILED=1
fi
echo ""

# 2. Search for forbidden patterns
echo "🚫 Checking for forbidden patterns..."

# Check for user.fullName
if grep -r "user\.fullName" app/ lib/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null; then
    echo -e "${RED}❌ Found forbidden pattern: user.fullName${NC}"
    echo "   Use user.name instead"
    FAILED=1
else
    echo -e "${GREEN}✅ No user.fullName found${NC}"
fi

# Check for user.followers_count (snake_case)
if grep -r "user\.followers_count\|user\.posts_count\|user\.following_count" app/ lib/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null; then
    echo -e "${RED}❌ Found forbidden pattern: snake_case count properties${NC}"
    echo "   Use followersCount, postsCount, followingCount"
    FAILED=1
else
    echo -e "${GREEN}✅ No snake_case count properties${NC}"
fi

# Check for String(user.id) in conversation calls
if grep -r "getOrCreateConversation.*String(user\.id)" app/ lib/ --include="*.tsx" --include="*.ts" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: Found String(user.id) in getOrCreateConversation${NC}"
    echo "   Consider using user.username or user.authId instead"
fi

echo ""

# 3. Check for console.log in production code (warning only)
echo "📝 Checking for debug statements..."
LOG_COUNT=$(grep -r "console\.log\|console\.debug" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l || echo "0")
if [ "$LOG_COUNT" -gt 10 ]; then
    echo -e "${YELLOW}⚠️  Warning: Found $LOG_COUNT console.log statements${NC}"
    echo "   Consider removing debug logs before deploy"
else
    echo -e "${GREEN}✅ Debug statements look reasonable${NC}"
fi
echo ""

# 4. Check git status
echo "📦 Checking git status..."
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    echo "   Make sure to commit before deploying"
else
    echo -e "${GREEN}✅ Working directory is clean${NC}"
fi
echo ""

# Summary
if [ $FAILED -eq 1 ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ PRE-DEPLOYMENT CHECKS FAILED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    echo "See docs/DEPLOYMENT_SAFETY.md for guidance."
    exit 1
else
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ALL CHECKS PASSED - SAFE TO DEPLOY${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. git push origin main"
    echo "  2. eas update --branch production --message \"YOUR_MESSAGE\""
    echo "  3. Monitor crash logs for 15 minutes"
    exit 0
fi
