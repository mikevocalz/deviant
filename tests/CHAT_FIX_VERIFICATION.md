# Chat Fix Verification Checklist - EMERGENCY TRIAGE

## Pre-Ship Verification Required

### Build Type: RELEASE or DEV-PRODUCTION-LIKE
- [ ] Using release build or dev build with production-like conditions
- [ ] Not using Expo Go or development server
- [ ] Metro bundler in production mode

---

## Test Matrix (All Must Pass)

### 1. Entry Point Tests
- [ ] **Profile → Message Button**
  - Open user profile
  - Tap "Message" button
  - Chat opens without crash
  - No "Maximum update depth exceeded" error
  - No repeated console logs

- [ ] **Inbox → Conversation**
  - Open messages/inbox screen
  - Tap existing conversation
  - Chat opens without crash
  - No "Maximum update depth exceeded" error
  - No repeated console logs

- [ ] **Group Thread**
  - Open group conversation from inbox
  - Chat opens without crash
  - Group members load correctly
  - No "Maximum update depth exceeded" error

- [ ] **Notification Entry**
  - Receive message notification
  - Tap notification
  - Chat opens without crash
  - Correct conversation loads
  - No "Maximum update depth exceeded" error

### 2. Rapid Navigation Tests
- [ ] **Rapid Open/Close (10x)**
  - Open chat → back → open same chat → back (repeat 10x)
  - No crashes
  - No "Maximum update depth exceeded" error
  - No memory leaks
  - Performance remains stable

- [ ] **Rapid Thread Switching (10x)**
  - Open chat A → back → open chat B → back (repeat 10x)
  - No crashes
  - No "Maximum update depth exceeded" error
  - Correct messages load for each chat
  - No state leakage between chats

### 3. Launch Tests
- [ ] **Cold Launch → Chat**
  - Force quit app
  - Launch app
  - Navigate to chat
  - No crashes
  - No "Maximum update depth exceeded" error

- [ ] **Warm Launch → Chat**
  - Background app
  - Return to app
  - Navigate to chat
  - No crashes
  - No "Maximum update depth exceeded" error

- [ ] **Deep Link Cold Start**
  - Force quit app
  - Open chat via deep link
  - No crashes
  - No "Maximum update depth exceeded" error
  - Correct conversation loads

- [ ] **Deep Link Warm Start**
  - App in background
  - Open chat via deep link
  - No crashes
  - No "Maximum update depth exceeded" error

### 4. Console Log Verification
- [ ] **No Repeated Effect Logs**
  - Monitor console during chat open
  - Should see each effect log ONCE:
    - `[Chat] Loading messages for conversation: X` (once)
    - `[Chat] Subscribing to realtime messages: chat-X-...` (once)
    - `[Chat] Loading conversation data for: X` (once)
  - Should NOT see repeated logs

- [ ] **No Loop Detection Warnings**
  - No "Effect 'X' has fired 10+ times" warnings
  - No "Rapid-fire detected" warnings
  - No "LOOP DETECTED" errors

### 5. Navigation Verification
- [ ] **No Repeated Navigation**
  - Open chat
  - Monitor navigation events
  - Should see single push/replace
  - Should NOT see repeated router.push/replace

- [ ] **No Route Thrashing**
  - Open chat
  - Should NOT see "not found then appears" pattern
  - Should NOT see rapid route changes

### 6. Bootstrap Verification
- [ ] **No Duplicate Loads**
  - Open chat
  - Monitor API calls
  - Should see single loadMessages call
  - Should NOT see duplicate API calls

- [ ] **No Duplicate Subscriptions**
  - Open chat
  - Monitor realtime subscriptions
  - Should see single subscription setup
  - Should NOT see multiple subscriptions for same chat

### 7. State Verification
- [ ] **Clean State on Unmount**
  - Open chat A
  - Back to inbox
  - Open chat B
  - Chat B should NOT show chat A's data
  - No state leakage

- [ ] **Correct Recipient Data**
  - Open chat
  - Header shows correct username/avatar
  - No "undefined" or placeholder data
  - Recipient info loads correctly

### 8. Feature Regression Tests
- [ ] **Typing Indicator Works**
  - Open chat
  - Other user types
  - Typing indicator appears

- [ ] **Presence Works**
  - Open chat
  - Shows "Active now" or last seen
  - Updates correctly

- [ ] **Realtime Messages**
  - Open chat
  - Other user sends message
  - Message appears instantly

- [ ] **Read Receipts**
  - Send message
  - Shows "Read" when recipient reads
  - Updates correctly

- [ ] **Optimistic Updates**
  - Send message
  - Message appears instantly
  - No flicker or duplicate

- [ ] **Media Sending**
  - Send photo/video
  - Uploads correctly
  - No crashes

### 9. Platform Tests
- [ ] **iOS Testing**
  - All above tests pass on iOS
  - No iOS-specific crashes

- [ ] **Android Testing**
  - All above tests pass on Android
  - No Android-specific crashes

### 10. Network Condition Tests
- [ ] **Slow Network (3G)**
  - Enable network throttling
  - Open chat
  - Shows loading state
  - No timeout loops
  - Eventually loads correctly

- [ ] **Offline → Online**
  - Go offline
  - Open chat
  - Go online
  - Recovers correctly
  - No crashes

---

## Success Criteria (All Must Be True)

- ✅ Zero "Maximum update depth exceeded" errors
- ✅ Zero infinite console log loops
- ✅ Zero flashing/remounting screens
- ✅ Single loadMessages call per conversation
- ✅ All entry points work (profile, inbox, notifications, deep links)
- ✅ Rapid navigation stable (10x back/forth)
- ✅ Same thread repeatedly stable (open 10x)
- ✅ Cold/warm launch stable
- ✅ All features work (typing, presence, realtime, read receipts, optimistic updates)
- ✅ No state leakage between chats
- ✅ Clean console logs (no repeated effects)

---

## Verification Status

**Tested By**: _________________  
**Date**: _________________  
**Build**: _________________  
**Platform**: iOS ☐ Android ☐ Both ☐  

**Result**: PASS ☐ FAIL ☐  

**Notes**:
```
[Add any observations, issues, or concerns here]
```

---

## If Verification FAILS

**DO NOT SHIP**. Document failure and fix before proceeding:

1. Note exact failure scenario
2. Capture console logs
3. Capture crash report if applicable
4. Identify root cause
5. Implement fix
6. Re-run full verification

---

## If Verification PASSES

**PROCEED TO SHIP**:

1. Commit all changes
2. Create PR with verification checklist
3. Deploy to production
4. Monitor crash reports for 24 hours
5. Proceed to Phase 2 (Post Detail fix)
