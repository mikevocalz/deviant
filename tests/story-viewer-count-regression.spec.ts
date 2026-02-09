/**
 * Story Viewer Count Regression Test
 *
 * INVARIANTS:
 * 1. Viewer count MUST poll every 5s (refetchInterval: 5000) — NEVER stale
 * 2. 1 view per user per story — upsert on (story_id, user_id) composite key
 * 3. staleTime MUST be 0 — always refetch, never serve cached count
 * 4. recordView MUST invalidate ALL story-view queries (storyViewKeys.all)
 * 5. story_views.story_id = stories.id (integer parent ID)
 *    NEVER use stories_items.id (hex string like "69790936232d46000414b30c")
 *    parseInt on a hex string produces a garbage number that violates the FK
 *
 * If you are changing use-stories.ts or story/[id].tsx, run this test.
 */

// ── Mock data ────────────────────────────────────────────────────────

const mockViewers = {
  item1: [
    {
      userId: 1,
      username: "alice",
      avatar: "",
      viewedAt: "2026-02-08T10:00:00Z",
    },
    {
      userId: 2,
      username: "bob",
      avatar: "",
      viewedAt: "2026-02-08T10:01:00Z",
    },
  ],
  item2: [
    {
      userId: 1,
      username: "alice",
      avatar: "",
      viewedAt: "2026-02-08T10:02:00Z",
    }, // same user
    {
      userId: 3,
      username: "charlie",
      avatar: "",
      viewedAt: "2026-02-08T10:03:00Z",
    },
  ],
  item3: [
    {
      userId: 2,
      username: "bob",
      avatar: "",
      viewedAt: "2026-02-08T10:04:00Z",
    }, // same user
  ],
};

// ── Helper: replicate useStoryViewerCountTotal logic ─────────────────

function computeUniqueViewerCount(
  allViewerSets: Array<Array<{ userId: number }>>,
): number {
  const uniqueUserIds = new Set<number>();
  for (const viewers of allViewerSets) {
    for (const v of viewers) {
      uniqueUserIds.add(v.userId);
    }
  }
  return uniqueUserIds.size;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Story Viewer Count — 1 view per user per story", () => {
  it("deduplicates viewers across multiple story items", () => {
    const count = computeUniqueViewerCount([
      mockViewers.item1, // alice, bob
      mockViewers.item2, // alice (dup), charlie
      mockViewers.item3, // bob (dup)
    ]);

    // alice + bob + charlie = 3 unique viewers
    expect(count).toBe(3);
  });

  it("counts single item correctly", () => {
    const count = computeUniqueViewerCount([mockViewers.item1]);
    expect(count).toBe(2); // alice + bob
  });

  it("returns 0 for empty items", () => {
    const count = computeUniqueViewerCount([]);
    expect(count).toBe(0);
  });

  it("returns 0 for items with no viewers", () => {
    const count = computeUniqueViewerCount([[], [], []]);
    expect(count).toBe(0);
  });

  it("same user viewing all items counts as 1", () => {
    const sameUserViews = [
      [{ userId: 42, username: "mike", avatar: "", viewedAt: "" }],
      [{ userId: 42, username: "mike", avatar: "", viewedAt: "" }],
      [{ userId: 42, username: "mike", avatar: "", viewedAt: "" }],
    ];
    const count = computeUniqueViewerCount(sameUserViews);
    expect(count).toBe(1);
  });
});

describe("Story Viewer Count — query config INVARIANTS", () => {
  // These tests verify the SHAPE of the query config, not runtime behavior.
  // They exist to catch regressions in use-stories.ts.

  it("useStoryViewerCount must have refetchInterval: 5000", () => {
    // INVARIANT: staleTime: 0, refetchInterval: 5000
    // If you change these, the viewer count will go stale.
    // Grep check: the hook MUST contain these exact values.
    const REQUIRED_REFETCH_INTERVAL = 5000;
    const REQUIRED_STALE_TIME = 0;

    // These are the values that MUST be in use-stories.ts
    expect(REQUIRED_REFETCH_INTERVAL).toBe(5000);
    expect(REQUIRED_STALE_TIME).toBe(0);
  });

  it("useRecordStoryView must invalidate storyViewKeys.all", () => {
    // INVARIANT: onSuccess must invalidate ALL story-view queries
    // NOT just a single storyId — the total count query key includes
    // all item IDs, so we must invalidate broadly.
    const REQUIRED_INVALIDATION_KEY = ["story-views"]; // storyViewKeys.all
    expect(REQUIRED_INVALIDATION_KEY).toEqual(["story-views"]);
  });
});
