/**
 * Story Thumbnail Regression Test
 *
 * INVARIANT: Story thumbnails in the stories bar MUST always show the
 * MOST RECENT (last) story item's thumbnail/url — NEVER the first item,
 * and NEVER the user's profile avatar.
 *
 * This test exists because this regressed multiple times:
 * - Initially showed profile avatar instead of story media
 * - Then showed first item instead of most recent
 *
 * If you are changing stories-bar.tsx or story-ring.tsx, run this test.
 */

// ── Mock story data ──────────────────────────────────────────────────

const makeStory = (overrides: Partial<any> = {}) => ({
  id: "story-1",
  userId: "42",
  username: "testuser",
  avatar: "https://example.com/profile-avatar.jpg",
  hasStory: true,
  isViewed: false,
  hasCloseFriendsStory: false,
  items: [
    {
      id: "item-old",
      url: "https://cdn.example.com/old-story.jpg",
      thumbnail: "https://cdn.example.com/old-story-thumb.jpg",
      type: "image",
      duration: 5000,
    },
    {
      id: "item-middle",
      url: "https://cdn.example.com/middle-story.jpg",
      thumbnail: "https://cdn.example.com/middle-story-thumb.jpg",
      type: "image",
      duration: 5000,
    },
    {
      id: "item-newest",
      url: "https://cdn.example.com/newest-story.jpg",
      thumbnail: "https://cdn.example.com/newest-story-thumb.jpg",
      type: "image",
      duration: 5000,
    },
  ],
  ...overrides,
});

// ── Helper: extract thumbnail the same way stories-bar.tsx does ──────

function getStoryThumbnail(story: ReturnType<typeof makeStory>): string | undefined {
  // This MUST match the logic in stories-bar.tsx
  const latestItem = story.items?.[story.items.length - 1];
  return latestItem?.thumbnail || latestItem?.url || story.avatar || undefined;
}

function getOwnStoryThumbnail(story: ReturnType<typeof makeStory>): string | undefined {
  // This MUST match the logic in stories-bar.tsx for "Your Story" StoryRing
  const latest = story.items?.[story.items.length - 1];
  return latest?.type === "video"
    ? latest?.thumbnail || latest?.url
    : latest?.url;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Story Thumbnail — MUST use most recent item", () => {
  it("uses the LAST item thumbnail, not the first", () => {
    const story = makeStory();
    const thumb = getStoryThumbnail(story);

    // MUST be the newest item's thumbnail
    expect(thumb).toBe("https://cdn.example.com/newest-story-thumb.jpg");

    // MUST NOT be the first item
    expect(thumb).not.toBe("https://cdn.example.com/old-story-thumb.jpg");

    // MUST NOT be the profile avatar
    expect(thumb).not.toBe("https://example.com/profile-avatar.jpg");
  });

  it("falls back to latest item url if no thumbnail", () => {
    const story = makeStory({
      items: [
        { id: "old", url: "https://cdn.example.com/old.jpg", type: "image", duration: 5000 },
        { id: "new", url: "https://cdn.example.com/new.jpg", type: "image", duration: 5000 },
      ],
    });
    const thumb = getStoryThumbnail(story);
    expect(thumb).toBe("https://cdn.example.com/new.jpg");
  });

  it("falls back to avatar only if no items exist", () => {
    const story = makeStory({ items: [] });
    const thumb = getStoryThumbnail(story);
    expect(thumb).toBe("https://example.com/profile-avatar.jpg");
  });

  it("own story thumbnail uses most recent item", () => {
    const story = makeStory();
    const thumb = getOwnStoryThumbnail(story);
    expect(thumb).toBe("https://cdn.example.com/newest-story.jpg");
    expect(thumb).not.toBe("https://cdn.example.com/old-story.jpg");
  });

  it("own story video uses thumbnail over url", () => {
    const story = makeStory({
      items: [
        { id: "old", url: "https://cdn.example.com/old.mp4", type: "video", duration: 30000 },
        {
          id: "new",
          url: "https://cdn.example.com/new.mp4",
          thumbnail: "https://cdn.example.com/new-thumb.jpg",
          type: "video",
          duration: 30000,
        },
      ],
    });
    const thumb = getOwnStoryThumbnail(story);
    expect(thumb).toBe("https://cdn.example.com/new-thumb.jpg");
  });

  it("NEVER returns first item when multiple items exist", () => {
    const story = makeStory();
    const thumb = getStoryThumbnail(story);
    const ownThumb = getOwnStoryThumbnail(story);

    const firstItemUrls = [
      story.items[0].url,
      story.items[0].thumbnail,
    ];

    expect(firstItemUrls).not.toContain(thumb);
    expect(firstItemUrls).not.toContain(ownThumb);
  });
});

describe("Story Thumbnail — FORBIDDEN patterns", () => {
  it("NEVER uses story.avatar when items have media", () => {
    const story = makeStory();
    const thumb = getStoryThumbnail(story);
    expect(thumb).not.toBe(story.avatar);
  });

  it("NEVER uses items[0] when items.length > 1", () => {
    const story = makeStory();
    const thumb = getStoryThumbnail(story);
    const firstThumb = story.items[0].thumbnail || story.items[0].url;
    expect(thumb).not.toBe(firstThumb);
  });
});
