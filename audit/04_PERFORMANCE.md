# Performance Audit

## PERF-01: MEDIUM — 109 setTimeout Usages

**Project rule** (CLAUDE.md): "NEVER use setTimeout as a debounce mechanism — use TanStack Debouncer (`@tanstack/react-pacer`)"

```bash
# Command used
grep -rn "setTimeout" lib/ app/ components/ src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
# Result: 109
```

**Impact**: setTimeout-based debounce creates memory leaks on unmount, doesn't cancel properly during navigation, and violates the project's own coding standards.

**Fix**: Audit each usage. Replace debounce-pattern setTimeouts with `@tanstack/react-pacer` Debouncer. Legitimate uses (animation delays, polling) can remain with a `// eslint-disable-next-line` comment.

---

## PERF-02: LOW — Banned FlatList in ChatSheet

**File**: `src/sneaky-lynk/ui/ChatSheet.tsx`

```typescript
import { View, Text, Pressable, Platform, FlatList } from "react-native";
```

**Project rule** (CLAUDE.md): "FlatList from react-native is BANNED. Use LegendList only."

**Fix**: Replace with `import { LegendList } from "@/components/list"` and add required props (`recycleItems`, `estimatedItemSize`, `keyExtractor`).

---

## PERF-03: LOW — Upload Timeout Uses rAF Polling

**File**: `lib/bunny-storage.ts:289-299`

```typescript
const scheduleAbort = () => {
  if (uploadAbort.signal.aborted) return;
  if (Date.now() - uploadStart >= UPLOAD_TIMEOUT_MS) {
    uploadAbort.abort();
  } else if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(scheduleAbort);
  }
};
```

**Impact**: Using `requestAnimationFrame` for a 120s timeout means ~7,200 rAF callbacks. This burns CPU cycles while the app is in the foreground. `AbortSignal.timeout(120_000)` is a zero-overhead alternative supported in Hermes.

**Fix**: Replace with `AbortSignal.timeout(UPLOAD_TIMEOUT_MS)` passed to the fetch/upload call.

---

## Positive Findings

- ✅ TanStack Query with persistence (`@tanstack/react-query-persist-client`) — good offline-first pattern
- ✅ LegendList used everywhere except 1 file — excellent list perf
- ✅ `react-native-compressor` used for media before upload — reduces upload size
- ✅ Image rendering via `expo-image` (not `Image` from RN) — supports caching, blurhash
- ✅ Zustand with MMKV persistence — faster than AsyncStorage
- ✅ Edge function response payloads are focused (no over-fetching)
- ✅ Batched conversations query in messages-impl.ts (O(4) queries, not O(N×4))
