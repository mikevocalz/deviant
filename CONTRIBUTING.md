# Contributing to Deviant

## Lists Policy (MANDATORY)

**LegendList is the only allowed list component. This is non-negotiable.**

### What's Allowed

| Component | Source | Status |
| --- | --- | --- |
| `LegendList` | `@/components/list` | ✅ **Required** |

### What's Banned

| Component | Source | Status |
| --- | --- | --- |
| `FlatList` | `react-native` | ❌ **Banned** |
| `SectionList` | `react-native` | ❌ **Banned** |
| `VirtualizedList` | `react-native` | ❌ **Banned** |
| `FlashList` | `@shopify/flash-list` | ❌ **Banned & Removed** |

### Import Path

All list imports **must** come from the single blessed path:

```tsx
import { LegendList } from "@/components/list";
import type { LegendListRef, LegendListProps } from "@/components/list";
```

Direct imports from `@legendapp/list` are **not allowed** outside of `components/list/index.ts`.

### CI Enforcement

- **ESLint** `no-restricted-imports` rule blocks all banned list imports
- PRs that introduce FlatList, FlashList, SectionList, or VirtualizedList will **fail CI**
- PRs that import directly from `@legendapp/list` (bypassing the blessed path) will **fail CI**

### DEV Runtime Guard

A runtime guard in `lib/guards/list-guard.ts` runs on app boot in development:
- **Throws** if `@shopify/flash-list` is detected as installed
- Logs confirmation when policy is satisfied

### No Exceptions

- No "small list" exceptions
- No conditional fallbacks to FlatList
- No new abstractions that wrap FlatList internally
- No re-introduction of `@shopify/flash-list` as a dependency

### Required Props for LegendList

When using LegendList, always provide:
- **`recycleItems`** — Enables view recycling for performance
- **`estimatedItemSize`** — Pixel estimate for average item height
- **`keyExtractor`** — Stable, unique key per item
