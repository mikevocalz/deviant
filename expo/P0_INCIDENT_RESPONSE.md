# P0 Production Incident: Maximum Update Depth Exceeded

## Incident Status: IN PROGRESS
**Severity**: P0 - Production Stop-the-Line  
**Started**: Mar 22, 2026 7:43pm UTC-04:00  
**Lead**: Distinguished Staff Engineer  
**Scope**: App-wide audit and fix for all infinite render/update loops

---

## Current Status Summary

### ✅ COMPLETED
1. **Chat Screen Fix** - All 5 root causes eliminated
2. **Shared Hardening Utilities Created**:
   - `lib/navigation/route-params.ts` - Param normalization
   - `lib/navigation/chat-routes.ts` - Canonical chat routing
   - `lib/hooks/use-safe-header.ts` - Safe header updates
   - `lib/patterns/screen-state-machine.ts` - State machine pattern
   - `lib/diagnostics/loop-detection.ts` - App-wide loop detection
   - `lib/stores/chat-screen-store.ts` - Zustand screen state

### 🔄 IN PROGRESS
3. **App-Wide Audit** - Identifying all high-risk screens
4. **Post Detail Screen Audit** - Analyzing loop patterns

### ⏳ PENDING
5. Event Detail Screen Audit
6. Story Viewer Audit
7. All navigation.setOptions Patterns
8. Implementation of Fixes
9. Comprehensive Testing
10. Production Deployment

---

## Findings: High-Risk Screens Identified

### CRITICAL: 34 Routed Screens Using `useLocalSearchParams`
All require param normalization to prevent string|string[] instability loops.

### HIGH RISK: Post Detail (`app/(protected)/post/[id].tsx`)
**Patterns Detected**:
- ❌ Raw `useLocalSearchParams()` without normalization
- ❌ 9 `useState` calls (violates Zustand mandate)
- ❌ `useFocusEffect` with video player dependencies
- ❌ Complex video lifecycle with multiple effects
- ⚠️ Tag overlay state management

**Impact**: High-traffic screen, crashes affect core UX

### HIGH RISK: Event Detail (`app/(protected)/events/[id]/index.tsx`)
**Patterns Detected**:
- ❌ Direct param access without normalization
- ❌ Complex event data fetching
- ⚠️ Ticket purchase flows
- ⚠️ Map integration

**Impact**: Revenue-critical screen, crashes block ticket sales

### HIGH RISK: Story Viewer (`app/(protected)/story/[id].tsx`)
**Patterns Detected**:
- ❌ Direct param access without normalization
- ❌ Video player lifecycle
- ⚠️ Gesture handlers
- ⚠️ Auto-advance logic

**Impact**: High-engagement feature, crashes affect retention

### MEDIUM RISK: 8 Screens with `navigation.setOptions` Loops
**Affected Screens**:
- `events/[id]/comments.tsx`
- `story/editor.tsx`
- `story/create.tsx`
- `events/create.tsx`
- `crop-preview.tsx`
- `comments/replies/[commentId].tsx`
- Others TBD

**Pattern**: Header updates in `useLayoutEffect` without stable deps

---

## Root Cause Patterns (App-Wide)

### Pattern 1: Raw useLocalSearchParams (34 screens)
**Risk**: string|string[] type instability → render loops  
**Fix**: Use `normalizeRouteParams()` with `useMemo`

### Pattern 2: navigation.setOptions Without Guards (8+ screens)
**Risk**: Header updates every render → infinite loops  
**Fix**: Use `useSafeHeader()` or `useSafeHeaderTitle()`

### Pattern 3: useState Violations (Multiple screens)
**Risk**: Violates project mandate, causes render loops  
**Fix**: Migrate to Zustand stores

### Pattern 4: useFocusEffect with Unstable Deps (Multiple screens)
**Risk**: Focus/blur cycles → infinite loops  
**Fix**: Stable dependencies, ref guards

### Pattern 5: No Bootstrap Guards (Multiple screens)
**Risk**: Repeated create/fetch attempts → loops  
**Fix**: Use `useBootstrapGuard()` or state machine

---

## Shared Utilities Created (Production-Grade)

### 1. Route Param Normalizer (`lib/navigation/route-params.ts`)
```typescript
// Prevents string|string[] instability loops
const { id, username } = useMemo(
  () => normalizeRouteParams(rawParams),
  [rawParams.id, rawParams.username]
);
```

### 2. Safe Header Update (`lib/hooks/use-safe-header.ts`)
```typescript
// Prevents navigation.setOptions loops
useSafeHeaderTitle(title); // Only updates when title changes
```

### 3. Screen State Machine (`lib/patterns/screen-state-machine.ts`)
```typescript
// Prevents bootstrap loops
const { phase, transitionTo } = useScreenStateMachine("idle");
```

### 4. Loop Detection (`lib/diagnostics/loop-detection.ts`)
```typescript
// DEV-only monitoring
useEffectLoopDetector("PostDetail", "loadPost");
useRenderLoopDetector("PostDetail");
```

---

## Implementation Strategy

### Phase 1: Critical Screens (P0) - 4-6 hours
1. ✅ Chat screen (COMPLETE)
2. 🔄 Post detail screen (IN PROGRESS)
3. ⏳ Event detail screen
4. ⏳ Story viewer screen

### Phase 2: High-Risk Patterns (P1) - 2-3 hours
5. All navigation.setOptions loops
6. All useState violations
7. All useFocusEffect patterns
8. All bootstrap/create-on-mount patterns

### Phase 3: Verification (P0) - 2-3 hours
9. Manual testing all entry points
10. Device testing iOS + Android
11. Stress testing (rapid navigation 10x)
12. Monitor production logs

### Phase 4: Deployment (P0) - 1 hour
13. Deploy with monitoring
14. Watch crash reports
15. Remove diagnostics after 1 week stable

**Total Estimated Time**: 9-13 hours for complete resolution

---

## Success Criteria (All Must Pass)

- ✅ Zero "Maximum update depth exceeded" errors
- ✅ All routed screens open reliably
- ✅ Rapid navigation stable (10x back/forth)
- ✅ Deep links work
- ✅ All features preserved (UX, messaging, events, stories)
- ✅ No performance regressions
- ✅ Clean console logs (no repeated effects)

---

## Immediate Next Actions

1. **Complete Post Detail Audit** (30 min)
   - Identify all loop sources
   - Document fix requirements
   - Estimate implementation time

2. **Complete Event Detail Audit** (30 min)
   - Identify all loop sources
   - Document fix requirements
   - Estimate implementation time

3. **Complete Story Viewer Audit** (30 min)
   - Identify all loop sources
   - Document fix requirements
   - Estimate implementation time

4. **Implement Fixes for Critical Screens** (3-4 hours)
   - Post detail screen
   - Event detail screen
   - Story viewer screen
   - Apply shared utilities

5. **Test All Fixes** (2-3 hours)
   - Manual testing
   - Device testing
   - Stress testing
   - Verify no loops

6. **Deploy with Monitoring** (1 hour)
   - Production deploy
   - Monitor crash reports
   - Watch for any remaining loops

---

## Risk Assessment

**Current Risk**: HIGH - Multiple screens likely affected  
**Post-Fix Risk**: LOW - Comprehensive hardening prevents recurrence  
**Rollback Risk**: LOW - Fixes are isolated and testable  
**Production Impact**: HIGH - Crashes block core user flows

---

## Rollback Plan

If critical issues arise post-deploy:

1. **Immediate**: Revert last deploy
2. **Monitor**: Check if crashes stop
3. **Analyze**: Review crash logs for new patterns
4. **Fix**: Address any new issues
5. **Re-deploy**: With additional fixes

---

## Communication Plan

- **Engineering Team**: Hourly updates on progress
- **Product Team**: Notify when fix is deployed
- **Support Team**: Monitor user reports
- **On-Call**: Immediate escalation if new crashes

---

## Monitoring & Verification

### Dev/Staging Monitoring
- Console logs for repeated effects
- Loop detection diagnostics
- Render count tracking
- Navigation event tracking

### Production Monitoring
- Crash report frequency
- "Maximum update depth" error count
- Screen load success rates
- User session stability

### Success Metrics
- Zero "Maximum update depth" crashes
- Screen load success rate >99.9%
- No increase in other error types
- No performance degradation

---

## Documentation

- **Technical Details**: `docs/CHAT_ROUTING_FIX.md`
- **App-Wide Audit**: `docs/P0_INFINITE_LOOP_AUDIT.md`
- **Shared Utilities**: Code comments in each utility file
- **Test Matrix**: TBD after all fixes implemented

---

## Lessons Learned (Preliminary)

1. **Param normalization is critical** - string|string[] instability causes loops
2. **Header updates need guards** - navigation.setOptions can loop
3. **useState violations are dangerous** - Project mandate exists for a reason
4. **Bootstrap needs guards** - Prevent duplicate create/fetch attempts
5. **Shared utilities prevent recurrence** - Centralized patterns enforce safety

---

**Last Updated**: Mar 22, 2026 (Current Session)  
**Status**: Shared utilities complete, continuing app-wide audit  
**ETA**: 9-13 hours for complete resolution
