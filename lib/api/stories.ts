import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import {
  getCurrentUserId,
  getCurrentUserIdInt,
  getCurrentUserAuthId,
} from "./auth-helper";
import { requireBetterAuthToken } from "../auth/identity";

interface CreateStoryResponse {
  ok: boolean;
  data?: { story: any };
  error?: { code: string; message: string };
}

export const storiesApi = {
  /**
   * Get stories feed (active stories from followed users)
   */
  async getStories() {
    try {
      console.log("[Stories] getStories");

      const userId = getCurrentUserId();
      const userIdInt = getCurrentUserIdInt();
      const authId = await getCurrentUserAuthId();
      if (!userId) return [];

      // Get non-expired stories
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(DB.stories.table)
        .select(
          `
          *,
          media:${DB.stories.mediaId}(url, mime_type),
          thumbnail:${DB.stories.thumbnailId}(url)
        `,
        )
        .gt(DB.stories.expiresAt, now)
        .order(DB.stories.createdAt, { ascending: false })
        .limit(50);

      if (error) throw error;

      // ── VISIBILITY ENFORCEMENT (server-side) ──────────────────────
      // Fetch which story owners have the current user as a close friend
      // so we can filter close_friends stories appropriately.
      let closeFriendOfSet = new Set<string>(); // auth_ids of owners who have me as close friend
      if (userIdInt) {
        const { data: cfRows } = await supabase
          .from("close_friends")
          .select("owner_id")
          .eq("friend_id", userIdInt);
        closeFriendOfSet = new Set((cfRows || []).map((r: any) => r.owner_id));
      }

      // Filter: remove close_friends stories the viewer isn't allowed to see
      const visibleStories = (data || []).filter((story: any) => {
        const vis = story[DB.stories.visibility];
        if (vis !== "close_friends") return true; // public/followers/private/null → pass through
        const storyAuthorId = story[DB.stories.authorId];
        // Owner always sees their own close_friends stories
        if (storyAuthorId === authId) return true;
        // Viewer must be in the owner's close friends list
        return closeFriendOfSet.has(storyAuthorId);
      });

      // Fetch author data separately since author_id is UUID
      const authorIds = [
        ...new Set(visibleStories.map((s: any) => s[DB.stories.authorId])),
      ];

      const { data: authors } = await supabase
        .from(DB.users.table)
        .select(
          `${DB.users.id}, ${DB.users.authId}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
        )
        .in(DB.users.authId, authorIds);

      const authorsMap = new Map(
        (authors || []).map((a: any) => [a[DB.users.authId], a]),
      );

      // Group by author - stories-bar expects 'items' array, not 'stories'
      const storiesByAuthor = new Map();

      visibleStories.forEach((story: any) => {
        const authorId = story[DB.stories.authorId];
        const author = authorsMap.get(authorId);
        const authorIntId = author?.[DB.users.id]
          ? String(author[DB.users.id])
          : authorId;
        const visibility = story[DB.stories.visibility] || "public";

        if (!storiesByAuthor.has(authorId)) {
          storiesByAuthor.set(authorId, {
            id: String(story[DB.stories.id]),
            userId: authorIntId,
            username: author?.[DB.users.username] || "unknown",
            avatar: author?.avatar?.url || "",
            hasStory: true,
            isViewed: story.viewed || false,
            isYou: authorIntId === userId,
            // Track if ANY story in this group is close_friends
            hasCloseFriendsStory: visibility === "close_friends",
            items: [],
          });
        } else if (visibility === "close_friends") {
          storiesByAuthor.get(authorId).hasCloseFriendsStory = true;
        }

        const mediaUrl = story.media?.url;
        if (mediaUrl) {
          const mimeType = story.media?.mime_type || "";
          const isVideo =
            mimeType.startsWith("video/") ||
            mediaUrl.endsWith(".mp4") ||
            mediaUrl.endsWith(".mov") ||
            mediaUrl.includes("/video/");
          const thumbnailUrl = story.thumbnail?.url || undefined;
          storiesByAuthor.get(authorId).items.push({
            id: String(story[DB.stories.id]),
            url: mediaUrl,
            thumbnail: thumbnailUrl,
            type: isVideo ? "video" : "image",
            duration: isVideo ? 30000 : 5000,
            visibility,
            header: {
              heading: author?.[DB.users.username] || "unknown",
              subheading: formatTimeAgo(story[DB.stories.createdAt]),
              profileImage: author?.avatar?.url || "",
            },
          });
        }
      });

      const result = Array.from(storiesByAuthor.values());
      console.log("[Stories] Returning", result.length, "story groups");
      return result;
    } catch (error) {
      console.error("[Stories] getStories error:", error);
      return [];
    }
  },

  /**
   * Create story
   */
  async createStory(storyData: {
    items: Array<{
      type: string;
      url?: string;
      thumbnail?: string;
      text?: string;
      textColor?: string;
      backgroundColor?: string;
    }>;
    visibility?: "public" | "close_friends";
  }) {
    try {
      console.log("[Stories] createStory");

      console.log("[Stories] createStory via Edge Function");

      const token = await requireBetterAuthToken();
      const visibility = storyData.visibility || "public";

      if (!storyData.items || storyData.items.length === 0) {
        throw new Error("Story must have at least one media item");
      }

      // Create one story row per item — they get grouped by author in getStories
      let lastStory: any = null;
      for (const item of storyData.items) {
        const mediaUrl = item.url || "";
        const mediaType = item.type === "video" ? "video" : "image";

        if (!mediaUrl) {
          console.warn("[Stories] Skipping item with no URL");
          continue;
        }

        const thumbnailUrl = item.thumbnail || undefined;
        const { data: response, error } =
          await supabase.functions.invoke<CreateStoryResponse>("create-story", {
            body: { mediaUrl, mediaType, visibility, thumbnailUrl },
            headers: { Authorization: `Bearer ${token}` },
          });

        if (error) {
          console.error("[Stories] Edge Function error for item:", error);
          throw new Error(error.message || "Failed to create story");
        }

        if (!response?.ok || !response?.data?.story) {
          const errorMessage =
            response?.error?.message || "Failed to create story";
          throw new Error(errorMessage);
        }

        console.log("[Stories] Story item created:", response.data.story.id);
        lastStory = response.data.story;
      }

      if (!lastStory) {
        throw new Error("No story items were created");
      }

      return lastStory;
    } catch (error) {
      console.error("[Stories] createStory error:", error);
      throw error;
    }
  },
  /**
   * Delete story via Edge Function (only owner can delete)
   */
  async deleteStory(storyId: string) {
    try {
      console.log("[Stories] deleteStory via Edge Function:", storyId);

      const token = await requireBetterAuthToken();
      const storyIdInt = parseInt(storyId);

      const { data: response, error } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { success: boolean };
        error?: { code: string; message: string };
      }>("delete-story", {
        body: { storyId: storyIdInt },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(error.message || "Failed to delete story");
      if (!response?.ok)
        throw new Error(response?.error?.message || "Failed to delete story");

      return { success: true };
    } catch (error) {
      console.error("[Stories] deleteStory error:", error);
      throw error;
    }
  },

  /**
   * Update story (only owner can update)
   */
  async updateStory(storyId: string, updates: { visibility?: string }) {
    try {
      console.log("[Stories] updateStory:", storyId);

      const authId = await getCurrentUserAuthId();
      if (!authId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from(DB.stories.table)
        .update({
          ...(updates.visibility && {
            [DB.stories.visibility]: updates.visibility,
          }),
        })
        .eq(DB.stories.id, storyId)
        .eq(DB.stories.authorId, authId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[Stories] updateStory error:", error);
      throw error;
    }
  },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours === 1) return "1h ago";
  return `${diffHours}h ago`;
}
