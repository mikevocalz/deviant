# Sneaky Lynk

Audio-first live rooms with optional video stage. A Twitter Spaces-like feature for the Deviant app.

## Overview

Sneaky Lynk allows users to create and join live audio rooms with optional video. Features include:
- **Audio-first rooms** with optional video stage
- **Real-time participant management** (speakers, listeners)
- **Active speaker detection** with animated pulse rings
- **Moderation tools** (kick, ban, end room)
- **Token-based authentication** with automatic refresh
- **Instant eject notifications** via Supabase Realtime

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Native App                          │
├─────────────────────────────────────────────────────────────────┤
│  app/(protected)/messages/                                       │
│    ├── _layout.tsx          # Nested tabs (Messages, Requests,  │
│    │                        #   Sneaky Lynk)                     │
│    ├── index.tsx            # Inbox messages                     │
│    ├── requests.tsx         # Message requests                   │
│    ├── sneaky-lynk.tsx      # Live rooms list                   │
│    └── sneaky-lynk/room/[id].tsx  # Room screen                 │
├─────────────────────────────────────────────────────────────────┤
│  src/sneaky-lynk/                                                │
│    ├── types/               # TypeScript types                   │
│    ├── mocks/               # Mock data for development          │
│    ├── api/                 # Supabase API client                │
│    ├── hooks/               # React hooks (useSneakyLynkRoom)    │
│    ├── rtc/                 # Fishjam RTC client                 │
│    └── ui/                  # UI components (NativeWind)         │
├─────────────────────────────────────────────────────────────────┤
│                      Supabase Edge Functions                     │
│    sneaky_create_room, sneaky_join_room, sneaky_refresh_token,  │
│    sneaky_kick_user, sneaky_ban_user, sneaky_end_room,          │
│    sneaky_toggle_hand                                            │
├─────────────────────────────────────────────────────────────────┤
│                      Supabase Database                           │
│    sneaky_rooms, sneaky_room_members, sneaky_room_bans,         │
│    sneaky_room_kicks, sneaky_room_tokens, sneaky_room_events    │
├─────────────────────────────────────────────────────────────────┤
│                         Fishjam RTC                              │
│    WebRTC audio/video, peer management, active speaker detection │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
app/(protected)/messages/
├── _layout.tsx                    # Nested tabs layout
├── index.tsx                      # Messages inbox
├── requests.tsx                   # Message requests
├── sneaky-lynk.tsx               # Live rooms list
└── sneaky-lynk/room/[id].tsx     # Room screen

src/sneaky-lynk/
├── types/index.ts                 # TypeScript types
├── mocks/data.ts                  # Mock data
├── api/supabase.ts               # API client
├── hooks/
│   ├── useSneakyLynkRoom.ts      # Main room hook
│   └── useRoomEvents.ts          # Realtime events
├── rtc/fishjamClient.ts          # Fishjam wrapper
└── ui/
    ├── index.ts                   # Exports
    ├── TopicPills.tsx            # Topic filter
    ├── LiveRoomCard.tsx          # Room card
    ├── ConnectionBanner.tsx      # Connection status
    ├── EjectModal.tsx            # Kick/ban modal
    ├── ControlsBar.tsx           # Bottom controls
    ├── SpeakerGrid.tsx           # Speakers with animations
    ├── ListenerGrid.tsx          # Listeners grid
    ├── VideoStage.tsx            # Featured video
    └── VideoThumbnailRow.tsx     # Video thumbnails

supabase/
├── migrations/20260205_sneaky_lynk.sql
└── functions/
    ├── sneaky_create_room/
    ├── sneaky_join_room/
    ├── sneaky_refresh_token/
    ├── sneaky_kick_user/
    ├── sneaky_ban_user/
    ├── sneaky_end_room/
    └── sneaky_toggle_hand/
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `sneaky_rooms` | Room metadata (title, topic, status, etc.) |
| `sneaky_room_members` | Participants with roles (host, moderator, speaker, listener) |
| `sneaky_room_bans` | Ban records with optional expiry |
| `sneaky_room_kicks` | Kick history |
| `sneaky_room_tokens` | Fishjam token tracking for revocation |
| `sneaky_room_events` | Events for Realtime subscriptions |

### RLS Policies

- **Rooms**: Authenticated users can read public rooms or rooms they're members of
- **Members**: Users can read members of rooms they belong to
- **Bans/Kicks**: Only host/moderators can read
- **Tokens**: Users can only read their own tokens
- **Events**: Members can read events for their rooms

All write operations go through Edge Functions with service role.

## Edge Functions

| Function | Description |
|----------|-------------|
| `sneaky_create_room` | Create room, add host |
| `sneaky_join_room` | Join room, mint Fishjam token |
| `sneaky_refresh_token` | Refresh Fishjam token |
| `sneaky_kick_user` | Kick user, revoke tokens, broadcast eject |
| `sneaky_ban_user` | Ban user, revoke tokens, broadcast eject |
| `sneaky_end_room` | End room, revoke all tokens, broadcast |
| `sneaky_toggle_hand` | Raise/lower hand, broadcast event |

## Environment Variables

Add to your `.env` and `eas.json`:

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Fishjam
EXPO_PUBLIC_FISHJAM_URL=https://your-fishjam-server.com
FISHJAM_API_KEY=your-fishjam-api-key  # Server-side only
```

## Dependencies

```bash
# Required packages
pnpm add @fishjam-cloud/react-native-client
pnpm add expo-linear-gradient
pnpm add lucide-react-native

# Already installed
# @supabase/supabase-js
# nativewind
# react-native-safe-area-context
```

## TODO: Switch from Mock to Real Data

1. **List Screen** (`sneaky-lynk.tsx`):
   - Replace `mockSpaces` with Supabase query
   - Subscribe to room changes for live updates

2. **Room Screen** (`room/[id].tsx`):
   - Connect `useSneakyLynkRoom` hook to real API
   - Replace mock speakers/listeners with Fishjam participants
   - Implement actual Fishjam video track rendering

3. **Fishjam Client** (`rtc/fishjamClient.ts`):
   - Replace mock implementation with `@fishjam-cloud/react-native-client`
   - Implement actual audio/video track management
   - Connect active speaker detection

## Testing Checklist

### Basic Flow
- [ ] Open Messages tab
- [ ] Navigate to "Sneaky Lynk" tab
- [ ] See list of live rooms (mock data)
- [ ] Filter by topic
- [ ] Tap room to enter

### Room Screen
- [ ] See room header with LIVE badge and listener count
- [ ] See video stage (if room has video)
- [ ] See speakers grid with animated pulse rings
- [ ] See listeners grid
- [ ] Toggle mic (visual feedback)
- [ ] Toggle video (if room supports)
- [ ] Raise/lower hand
- [ ] Leave room

### Moderation (requires real backend)
- [ ] Kick user → target sees EjectModal
- [ ] Ban user → target sees EjectModal, can't rejoin
- [ ] End room → all participants navigate out

### Token Management (requires real backend)
- [ ] Join room → receive Fishjam token
- [ ] Token auto-refreshes before expiry
- [ ] App foreground → check token validity
- [ ] Kicked/banned → token revoked, instant eject

## Design Notes

- **Audio-first**: Video is optional, audio is primary
- **Twitter Spaces vibe**: Clean, modern, gradient cards
- **Active speaker animation**: Pulse rings + scale on speaking avatars
- **NativeWind**: All styling via className, minimal StyleSheet
- **Animated API**: Used for pulse/scale animations (transform requires native driver)
