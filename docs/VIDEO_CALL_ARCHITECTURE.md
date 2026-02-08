# Video Call Architecture — Never-Black-Screen-Again

> **Status**: Enforced  
> **Last updated**: 2026-02-08  
> **Stack**: Expo Dev Client · Fishjam WebRTC SDK · Supabase Edge Functions · Zustand

---

## 1. Room & Token Invariants

### Rules
1. Rooms MUST be created server-side (`video_create_room`) BEFORE token issuance
2. Tokens are minted by `video_join_room` which creates a Fishjam peer
3. Tokens include: `roomId`, `userId`, `role`, `jti`, `expiresAt` (1 hour TTL)
4. Edge functions NEVER return empty 200 — always `{ ok: true/false, data?, error? }`

### Edge Function Contract
```
video_create_room → { ok, data: { room: { id (UUID), title, ... } } }
video_join_room   → { ok, data: { room, token, peer, user, expiresAt } }
```

### Required Environment Variables
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
FISHJAM_APP_ID, FISHJAM_API_KEY
DATABASE_URL (or SUPABASE_DB_URL)
BETTER_AUTH_SECRET
```

### Failure Modes
| Failure | Log | HTTP |
|---------|-----|------|
| No auth header | `[video_*] Auth error` | 401 |
| Session expired | `[video_*] Session expired` | 401 |
| Room not found | `[video_*] Room not found` | 404 |
| Fishjam API down | `[video_*] Fishjam room creation failed` | 500 |
| Rate limited | `[video_*] Too many attempts` | 429 |

---

## 2. Permission Gating (CRITICAL)

### Rule
**NO ROOM JOIN OCCURS UNTIL permissions are granted.**

### State Machine (`useMediaPermissions`)
```
pending → requesting → granted ✓
                     → denied  ✗ (show UI, link to Settings)
```

### Implementation
- `useMediaPermissions` hook in `src/video/hooks/useMediaPermissions.ts`
- Uses `react-native-vision-camera` permission hooks
- Updates Zustand store: `cameraPermission`, `micPermission`
- Sets `callPhase = "perms_denied"` on denial

### UI States
| State | UI |
|-------|-----|
| `pending` | Spinner + "Requesting permissions..." |
| `granted` | Proceed to room join |
| `denied` | Full-screen error + "Open Settings" button + "Go Back" |

---

## 3. Room Join Order (NON-NEGOTIABLE)

```
1. requestPermissions(callType)     → BLOCKS on denial
2. videoApi.createRoom()            → callPhase = "creating_room"
3. videoApi.joinRoom(roomId)        → callPhase = "joining_room"
4. fishjam.joinRoom({ peerToken })  → callPhase = "connecting_peer"
5. startMicrophone()                → callPhase = "starting_media"
6. startCamera(frontCameraId)       → verify cameraStream !== null
7. Render video                     → callPhase = "connected"
```

**Any deviation = architectural bug.**

### Guardrails
- `callPhase` state machine enforces order (Zustand store)
- Each phase transition is logged: `[VideoStore] Phase: X → Y`
- Each step checks the previous step's result before proceeding
- Failure at any step → `callPhase = "error"` with explicit message

---

## 4. Video Rendering Contract

### HARD RULE
**RTCView MUST NEVER RENDER WITHOUT a resolved video track.**

### Correct Pattern (VideoTile)
```tsx
const hasResolvedVideoTrack = (() => {
  if (!stream || isVideoOff) return false;
  try {
    const videoTracks = stream.getVideoTracks?.();
    return videoTracks && videoTracks.length > 0;
  } catch { return false; }
})();

{hasResolvedVideoTrack ? <RTCView ... /> : <AvatarFallback />}
```

### Anti-Patterns That Cause Black Screens
| Pattern | Why It's Wrong |
|---------|---------------|
| `{stream && <RTCView />}` | Stream may exist with 0 video tracks |
| `{!isVideoOff && <RTCView />}` | State may be stale; track may not be published |
| Rendering RTCView before `startCamera` resolves | Track not yet available |
| Rendering RTCView during `connecting_peer` phase | Peer not connected |

### Safe Participant → Track Resolution
```tsx
// Remote participants from Fishjam SDK
stream={p.videoTrack?.stream}        // ✅ Track-level stream
isVideoOff={!p.isCameraOn}           // ✅ Derived from track existence
```

---

## 5. State Management (Anti-Regression)

### Rule
**ALL call state lives in Zustand (`useVideoRoomStore`). NO useState for call state.**

### Zustand Store Schema
```typescript
interface VideoRoomStoreState {
  // Room
  room: VideoRoom | null;
  roomId: string | null;
  localUser: LocalUser | null;
  participants: Participant[];
  connectionState: ConnectionState;

  // Call lifecycle
  callPhase: CallPhase;  // strict state machine
  callType: CallType;    // "audio" | "video"
  chatId: string | null;
  callEnded: boolean;
  callDuration: number;
  callStartedAt: number | null;

  // Permissions
  cameraPermission: PermissionState;
  micPermission: PermissionState;

  // Media
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;
  localStream: MediaStream | null;

  // Error
  error: string | null;
  errorCode: string | null;

  // Eject
  isEjected: boolean;
  ejectReason?: EjectPayload;
}
```

### Allowed vs Forbidden
| ✅ Allowed | ❌ Forbidden |
|-----------|-------------|
| `useVideoRoomStore((s) => s.callPhase)` | `useState<CallPhase>()` |
| `getStore().setCallPhase("connected")` | `setState({ callPhase: "connected" })` |
| `useState(false)` for local UI toggles (e.g. bottom sheet) | `useState` for room, participants, tracks, media |

### Why useState Causes Black Screens in RTC Apps
1. **Stale closures**: Callbacks capture old state, miss track updates
2. **Render cascades**: setState triggers re-renders that re-fire effects
3. **No cross-component sync**: Multiple components can't share call state
4. **No bail-out**: Every setState triggers re-render even if value unchanged

---

## 6. Signaling → UI Navigation

### Contract
```
Supabase Realtime INSERT on call_signals (callee_id = myId, status = "ringing")
  → IncomingCallOverlay shows full-screen accept/decline UI
  → Accept → router.push("/call/[roomId]?callType=X")
  → Call screen mounts inside FishjamProvider
  → useVideoCall.joinCall(roomId, callType)
```

### Failure Scenarios
| Scenario | Handling |
|----------|---------|
| Signal arrives but user is on call | Ignore (or show "busy" in future) |
| Signal arrives but app is backgrounded | Push notification (future) |
| Accept but room no longer exists | `video_join_room` returns 404 → error UI |
| Signal timeout (30s) | Auto-dismiss overlay |

---

## 7. Platform-Specific Guarantees

### iOS
- `infoPlist.NSCameraUsageDescription` REQUIRED in `app.config.js`
- `infoPlist.NSMicrophoneUsageDescription` REQUIRED in `app.config.js`
- Simulator: Camera not available — test on device only
- Dev Client rebuild required after adding `react-native-webrtc`

### Android
- `android.permission.CAMERA` in AndroidManifest
- `android.permission.RECORD_AUDIO` in AndroidManifest
- Foreground service may be needed for background calls (future)
- Dev Client rebuild required after adding `react-native-webrtc`

### Expo
- **Dev Client only** — Expo Go does NOT support WebRTC
- `react-native-webrtc` must be linked (auto-linked via Expo config plugins)
- After any native dependency change: `eas build` required
- OTA updates work for JS-only changes

---

## 8. Observability & Fail-Loud Policy

### Logging Contract
Every log line is prefixed with `[VideoCall]`, `[VideoStore]`, `[Permissions]`, or `[CallSignals]`.

| Event | Log Level | Example |
|-------|-----------|---------|
| Phase transition | `log` | `[VideoStore] Phase: idle → creating_room` |
| Room created | `log` | `[VideoCall] Room created: <uuid>` |
| Peer connected | `log` | `[VideoCall] Fishjam peer join initiated` |
| Camera started | `log` | `[VideoCall] Camera started, track: true, stream: true` |
| Permission denied | `error` | `[Permissions] BLOCKED: Camera permission denied` |
| Camera stream null | `error` | `[VideoCall] CRITICAL: Camera started but cameraStream is null` |
| Room join failed | `error` | `[VideoCall] ERROR: Room join failed: <message>` |
| Media start failed | `error` | `[VideoCall] ERROR: FAILED to start camera: <error>` |

### NO SILENT FAILURES
- Every `catch` block logs the error AND updates the store
- Every error sets `callPhase = "error"` which renders explicit error UI
- No `catch(() => {})` or `catch(console.warn)` without store update

---

## 9. Black-Screen Failure Matrix

| Symptom | Root Cause | Detection | Fix |
|---------|-----------|-----------|-----|
| **Black local preview** | Camera started before peer connected | `callPhase` not `connected` when RTCView renders | Enforce join order: peer → media → render |
| **Black local preview** | `cameraStream` is null after `startCamera` | Log: `CRITICAL: cameraStream is null` | Check permissions, retry, show error UI |
| **Black local preview** | Wrong camera device (back instead of front) | No `front` in device label | Fallback to first available device |
| **Black remote video** | Remote peer hasn't published video track | `p.videoTrack` is undefined | Show avatar fallback, don't render RTCView |
| **Black remote video** | Stream exists but 0 video tracks | `getVideoTracks().length === 0` | `hasResolvedVideoTrack` guard in VideoTile |
| **Audio works, video doesn't** | Camera permission denied | `cameraPermission === "denied"` | Show permission denied UI with Settings link |
| **Audio works, video doesn't** | Camera in use by another app | `startCamera` throws | Log error, show error UI |
| **Call connects but UI doesn't change** | `callPhase` stuck in `connecting_peer` | Phase never transitions to `starting_media` | Timeout + error after 15s |
| **Works on Android, black on iOS** | Missing `NSCameraUsageDescription` | iOS blocks camera silently | Verify `infoPlist` in `app.config.js` |
| **Works on Android, black on iOS** | Simulator limitation | Camera not available in simulator | Test on physical device |
| **Intermittent black screen** | Race condition: render before track ready | RTCView renders with stale stream | `hasResolvedVideoTrack` guard |
| **Black after camera switch** | `_switchCamera` not available on track | Log: `_switchCamera not available` | Don't attempt switch, log warning |

---

## 10. Enforcement Rules

### Pre-Merge Checklist
- [ ] No `useState` for call state (room, participants, tracks, media, permissions)
- [ ] RTCView guarded by `hasResolvedVideoTrack` check
- [ ] Every `catch` block logs AND updates store error state
- [ ] `callPhase` transitions are sequential and logged
- [ ] Permissions requested and awaited BEFORE room join
- [ ] Front camera selected by default
- [ ] Error UI rendered for `callPhase === "error"` and `"perms_denied"`
- [ ] No empty 200 responses from edge functions
- [ ] TypeScript passes with zero errors

### Never-Regress Principles
1. **No optimistic RTCView rendering** — always check track existence
2. **No silent catch blocks** — every error must surface
3. **No useState for shared call state** — Zustand only
4. **No room join without permissions** — gated by state machine
5. **No camera start without peer connection** — join order enforced
6. **No edge function returns empty 200** — always `{ ok, data?, error? }`

### Key Files
| File | Purpose |
|------|---------|
| `src/video/stores/video-room-store.ts` | Zustand store — ALL call state |
| `lib/hooks/use-video-call.ts` | Call lifecycle hook — deterministic join order |
| `src/video/hooks/useMediaPermissions.ts` | Permission state machine |
| `app/(protected)/call/[roomId].tsx` | Call screen — phase-based rendering |
| `components/call/incoming-call-overlay.tsx` | Signaling → navigation |
| `supabase/functions/video_create_room/` | Room creation edge function |
| `supabase/functions/video_join_room/` | Room join + token minting |
