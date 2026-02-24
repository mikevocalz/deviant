# UX / UI / Product Design Audit

## Documented UI Invariants (Strong)

CLAUDE.md documents critical UX contracts that prevent regressions:

- **Story thumbnails** must show most recent item, not first item or avatar
- **Story viewer count** must poll every 5s with staleTime: 0
- **Message sender** must compare `=== "user"` string literal, never IDs
- **Avatar ownership** — entity avatars from entity data, never authUser
- **Event dates** — `event.date` is day number, use `event.fullDate` for ISO
- **Tab bar center button** — must be ABOVE the tab bar, positive bottom values only
- **Update toast** — must NEVER be removed or disabled, `duration: Infinity`

These invariants have corresponding regression tests in `tests/`.

---

## UX-01: LOW — No Global Loading Skeleton / Empty State Pattern

**Observation**: Screens handle loading states individually. There's no shared `<ScreenSkeleton>` or `<EmptyState>` component ensuring consistent UX across all 96 screens.

**Impact**: Users may see inconsistent loading indicators (spinner vs skeleton vs nothing) depending on which screen they're on.

**Recommendation**: Create shared components:

```typescript
// components/screen-skeleton.tsx — shimmer skeleton for any list/detail screen
// components/empty-state.tsx — icon + message + CTA for empty lists
```

---

## Navigation

- **Tab bar**: Bottom tabs with custom center button (create action)
- **Auth flow**: `(auth)/` group with login → signup → forgot-password → reset-password → onboarding
- **Protected flow**: `(protected)/` group gated by auth store
- **Settings**: Separate `settings/` group with 28 screens
- **Deep linking**: Configured via `lib/deep-linking/` with route registry + link engine

---

## Accessibility

**Not audited in depth** — would require device testing with VoiceOver/TalkBack. Key observations:

- `Pressable` used consistently (good — supports accessibility)
- No `accessibilityLabel` audit performed
- No high-contrast mode testing

---

## Positive Findings

- ✅ Sonner-native toasts used consistently (not Alert)
- ✅ KeyboardAwareScrollView for form screens
- ✅ Haptic feedback integration (expo-haptics)
- ✅ Dark mode support via NativeWind + useColorScheme
- ✅ Pull-to-refresh on list screens
- ✅ Optimistic UI for likes, follows, bookmarks (instant feedback)
- ✅ Progress overlay for upload/create flows
- ✅ Biometric lock support (expo-local-authentication)
