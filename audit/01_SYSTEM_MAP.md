# DVNT System Map

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  iOS / Android Native App (Expo SDK 55)         │
│  React Native 0.84 · Hermes · New Architecture  │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Expo     │ │ Zustand  │ │ TanStack Query │   │
│  │ Router   │ │ + MMKV   │ │ + Persist      │   │
│  └──────────┘ └──────────┘ └────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │NativeWind│ │ Skia     │ │ Reanimated     │   │
│  │ v4 (TW)  │ │ Canvas   │ │ + Gestures     │   │
│  └──────────┘ └──────────┘ └────────────────┘   │
└───────────┬─────────────┬───────────────────────┘
            │ anon reads  │ auth writes
            ▼             ▼
┌───────────────────┐  ┌──────────────────────────┐
│ Supabase Postgres │  │ Supabase Edge Functions   │
│ (RLS: anon=read)  │  │ (69 functions, Deno)      │
│                   │  │ service_role = full write  │
└───────────────────┘  └──────────┬───────────────┘
                                  │
            ┌─────────────────────┼─────────────────┐
            ▼                     ▼                  ▼
     ┌─────────────┐    ┌──────────────┐   ┌──────────────┐
     │ Better Auth  │    │ Stripe       │   │ Bunny CDN    │
     │ (auth EF)    │    │ (payments)   │   │ (media)      │
     └─────────────┘    └──────────────┘   │ ⚠ KEY CLIENT │
                                           └──────────────┘
```

## Key Paths

| Area | Path |
|------|------|
| **Navigation** | `app/` — Expo Router file-based routing |
| **Auth screens** | `app/(auth)/` — login, signup, forgot-password, reset-password |
| **Protected screens** | `app/(protected)/` — tabs, chat, post, events, profile |
| **Settings** | `app/settings/` — 28 settings screens |
| **Components** | `components/` — 110 reusable UI components |
| **Features** | `src/` — calls, video, camera, stories-editor, stickers, tickets |
| **State** | `lib/stores/` — Zustand stores (auth, chat, UI, feed, etc.) |
| **API layer** | `lib/api/` — Supabase client wrappers |
| **Auth** | `lib/auth-client.ts` — Better Auth client |
| **Supabase** | `lib/supabase/client.ts` — anon-only client |
| **Media** | `lib/bunny-storage.ts` — Bunny CDN uploads |
| **Edge Functions** | `supabase/functions/` — 69 Deno edge functions |
| **Shared helpers** | `supabase/functions/_shared/` — verify-session, etc. |
| **Migrations** | `supabase/migrations/` — 58 active, 18 skipped |
| **Plugins** | `plugins/` — 15 Expo config plugins |
| **Patches** | `patches/` — 2 patch-package patches |
| **Scripts** | `scripts/` — 25 utility scripts |
| **Tests** | `tests/` — regression tests + smoke checklist |
| **Theme** | `theme/` — color tokens |

## Edge Function Categories

| Category | Functions | Auth |
|----------|-----------|------|
| **Auth** | auth, auth-sync | Better Auth internal |
| **Social** | toggle-like, toggle-follow, toggle-bookmark, toggle-block, toggle-comment-like | verifySession |
| **Content** | create-post, update-post, delete-post, create-story, delete-story, add-comment, delete-comment | verifySession |
| **Messaging** | send-message, mark-read, create-conversation, react-message | verifySession |
| **Profiles** | update-profile, update-avatar, close-friends, user-settings | verifySession |
| **Queries** | get-bookmarks, get-followers, get-following, get-following-ids, get-liked-posts, get-post-comments, get-post-likers, get-story-viewers, get-viewer-liked-post-ids | verifySession |
| **Payments** | create-payment-intent, stripe-webhook, ticket-checkout, ticket-scan, payment-methods, purchases, sneaky-access-checkout | verifySession / webhook sig |
| **Promotions** | promotion-checkout, promotion-cancel, promotion-webhook | verifySession / webhook sig |
| **Organizer** | organizer-connect, host-disputes, host-payouts, host-transactions, payouts-release | verifySession |
| **Video** | video_create_room, video_join_room, video_refresh_token, video_end_room, video_kick_user, video_ban_user | verifySession + rate limit |
| **Media** | media-upload, cleanup-expired-media, backfill-thumbnails | verifySession |
| **Notifications** | send_notification, send-email | internal |
| **Bootstrap** | bootstrap-feed, bootstrap-events, bootstrap-messages, bootstrap-notifications, bootstrap-profile | verifySession |
| **Misc** | live-surface, share-page, branding, create-test-user, backfill-users, ticket_wallet_apple, ticket_wallet_google, reconcile-orders | mixed |

## Two User Tables

| Table | Purpose | ID Type | Created When |
|-------|---------|---------|-------------|
| `user` (Better Auth) | Auth signups | String (`'akTmS2...'`) | User signs up |
| `users` (App) | Profile data | Integer (`11`) | User completes onboarding |

Join: `users.auth_id = user.id`
