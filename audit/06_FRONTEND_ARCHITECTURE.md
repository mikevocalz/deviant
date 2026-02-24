# Frontend Architecture Audit

## Stack

- **Framework**: React Native 0.84.0 (New Architecture)
- **Runtime**: Hermes
- **SDK**: Expo 55.0.0-preview.12
- **Router**: Expo Router 55.0.0-preview.9
- **Styling**: NativeWind v4 (Tailwind CSS)
- **State**: Zustand 5.0.11 + MMKV persistence
- **Data**: TanStack Query 5.90.20 + persist-client
- **Lists**: LegendList (beta) — FlatList banned
- **Animations**: React Native Reanimated 4.2.2 + Gesture Handler 2.30
- **Canvas**: Shopify React Native Skia 2.4.21

## Route Structure (96 screens)

```
app/
├── _layout.tsx              — Root layout (splash, auth gate, providers)
├── (auth)/                  — 6 auth screens (login, signup, forgot-pw, etc.)
├── (protected)/
│   ├── _layout.tsx          — Auth guard layout
│   ├── (tabs)/              — Bottom tab navigator (feed, discover, profile, etc.)
│   ├── chat/[id].tsx        — Chat screen
│   ├── post/[id].tsx        — Post detail
│   ├── profile/[username].tsx
│   ├── events/              — Event screens
│   ├── story/               — Story create/view/editor
│   ├── call/                — Audio/video calls
│   └── ...                  — 10+ more route groups
├── (video)/                 — Video room screens
└── settings/                — 28 settings screens
```

## State Management

Zustand stores in `lib/stores/`:

- `auth-store.ts` — Auth state + MMKV persist + rehydration gate
- `chat-store.ts` — Messages, conversations, optimistic sends
- `ui-store.ts` — Toasts, modals, global UI state
- `feed-post-ui-store.ts` — Video states, pressed posts
- `post-store.ts` — Likes, counts, bookmarks
- `profile-store.ts` — Follow state
- `app-store.ts` — App readiness, splash

**Rule enforcement**: CLAUDE.md bans `useState` for app state — Zustand only. This is a good pattern for data isolation on user switch (all stores reset).

## FE-01: LOW — Stale Payload CMS References in CLAUDE.md

**File**: `CLAUDE.md:257-493`

Multiple sections reference Payload CMS, Vercel, and `+api.ts` routes that were removed months ago:

- Lines 257-303: "Payload CMS Database Optimization"
- Lines 366-493: "Database Schema Sync" with Payload collections
- Lines 1230-1326: "Payload CMS Integration" with `lib/payload.server.ts`

**Fix**: Remove or replace these sections with current Supabase Edge Function documentation. Stale docs in CLAUDE.md actively mislead AI assistants.

## FE-02: INFO — Expo SDK 55 Preview

`package.json:63`: `"expo": "55.0.0-preview.12"`

Running on a preview SDK means:

- No stable release notes or changelogs
- Potential breaking changes between preview releases
- Limited community support for issues

**Recommendation**: Pin to the latest stable Expo SDK when it releases. Document any preview-specific workarounds so they can be removed.

## Positive Findings

- ✅ Clean file-based routing with Expo Router
- ✅ Consistent use of Zustand over useState for app state
- ✅ TanStack Query for all server state with persistence
- ✅ LegendList enforced project-wide (1 exception)
- ✅ NativeWind provides consistent styling language
- ✅ Strong typing — 0 TypeScript errors
- ✅ Well-documented UI invariants in CLAUDE.md (stories, messages, events)
- ✅ Safe native module wrappers for OTA compatibility
- ✅ Deep linking properly configured with route registry
