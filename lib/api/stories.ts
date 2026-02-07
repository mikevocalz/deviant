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
      if (!userId) return [];

      // Get non-expired stories
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(DB.stories.table)
        .select(
          `
          *,
          media:${DB.stories.mediaId}(url)
        `,
        )
        .gt(DB.stories.expiresAt, now)
        .order(DB.stories.createdAt, { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch author data separately since author_id is UUID
      const authorIds = [
        ...new Set((data || []).map((s: any) => s[DB.stories.authorId])),
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

      (data || []).forEach((story: any) => {
        const authorId = story[DB.stories.authorId];
        const author = authorsMap.get(authorId);
        // Use integer user ID (from users table) so stories-bar can match against auth store user.id
        const authorIntId = author?.[DB.users.id]
          ? String(author[DB.users.id])
          : authorId;
        if (!storiesByAuthor.has(authorId)) {
          storiesByAuthor.set(authorId, {
            id: String(story[DB.stories.id]),
            userId: authorIntId, // Integer user ID for stories-bar matching
            username: author?.[DB.users.username] || "unknown",
            avatar: author?.avatar?.url || "",
            hasStory: true,
            isViewed: story.viewed || false,
            isYou: authorIntId === userId, // Compare integer IDs
            items: [],
          });
        }

        // Add item even if media URL is null - use placeholder or skip
        const mediaUrl = story.media?.url;
        if (mediaUrl) {
          storiesByAuthor.get(authorId).items.push({
            id: String(story[DB.stories.id]),
            url: mediaUrl,
            type: story.media ? "image" : "text",
            duration: 5000,
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
      text?: string;
      textColor?: string;
      backgroundColor?: string;
    }>;
  }) {
    try {
      console.log("[Stories] createStory");

      console.log("[Stories] createStory via Edge Function");

      const token = await requireBetterAuthToken();

      // Get the first media URL from items
      const firstItem = storyData.items[0];
      const mediaUrl = firstItem?.url || "";
      const mediaType = firstItem?.type === "video" ? "video" : "image";

      if (!mediaUrl) {
        throw new Error("Story must have media");
      }

      const { data: response, error } =
        await supabase.functions.invoke<CreateStoryResponse>("create-story", {
          body: {
            mediaUrl,
            mediaType,
            visibility: "public",
          },
          headers: { Authorization: `Bearer ${token}` },
        });

      if (error) {
        console.error("[Stories] Edge Function error:", error);
        throw new Error(error.message || "Failed to create story");
      }

      if (!response?.ok || !response?.data?.story) {
        const errorMessage =
          response?.error?.message || "Failed to create story";
        throw new Error(errorMessage);
      }

      console.log("[Stories] Story created:", response.data.story.id);
      return response.data.story;
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
