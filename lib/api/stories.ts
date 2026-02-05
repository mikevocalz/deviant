import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserId } from "./auth-helper";

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

      console.log("[Stories] Raw stories data:", data?.length, "stories found");
      if (data && data.length > 0) {
        console.log("[Stories] First story:", JSON.stringify(data[0]));
      }

      // Fetch author data separately since author_id is UUID
      const authorIds = [
        ...new Set((data || []).map((s: any) => s[DB.stories.authorId])),
      ];
      console.log("[Stories] Author IDs to fetch:", authorIds);

      const { data: authors, error: authorsError } = await supabase
        .from(DB.users.table)
        .select(
          `${DB.users.id}, ${DB.users.authId}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
        )
        .in(DB.users.authId, authorIds);

      console.log(
        "[Stories] Authors found:",
        authors?.length,
        authorsError ? `Error: ${authorsError.message}` : "",
      );

      const authorsMap = new Map(
        (authors || []).map((a: any) => [a[DB.users.authId], a]),
      );

      // Group by author - stories-bar expects 'items' array, not 'stories'
      const storiesByAuthor = new Map();

      (data || []).forEach((story: any) => {
        const authorId = story[DB.stories.authorId];
        const author = authorsMap.get(authorId);
        if (!storiesByAuthor.has(authorId)) {
          storiesByAuthor.set(authorId, {
            id: String(story[DB.stories.id]), // Use story ID, not author ID
            userId: authorId, // Store author ID separately for filtering
            username: author?.[DB.users.username] || "unknown",
            avatar: author?.avatar?.url || "",
            hasStory: true,
            isViewed: story.viewed || false,
            isYou: authorId === userId,
            items: [], // stories-bar expects 'items', not 'stories'
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

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Set expiry to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Get the first media URL from items
      const firstItem = storyData.items[0];
      const mediaUrl = firstItem?.url || "";

      let mediaId: number | null = null;

      // Create media record if we have a URL
      if (mediaUrl) {
        console.log("[Stories] Creating media record for URL:", mediaUrl);
        const { data: mediaData, error: mediaError } = await supabase
          .from(DB.media.table)
          .insert({
            [DB.media.url]: mediaUrl,
            [DB.media.ownerId]: userId,
            [DB.media.mimeType]:
              firstItem?.type === "video" ? "video/mp4" : "image/jpeg",
            [DB.media.filename]: mediaUrl.split("/").pop() || "story-media",
            type: firstItem?.type === "video" ? "video" : "image", // Required column
          })
          .select()
          .single();

        if (mediaError) {
          console.error(
            "[Stories] Failed to create media record:",
            mediaError.message,
            mediaError.details,
          );
        } else {
          mediaId = mediaData?.[DB.media.id];
          console.log("[Stories] Created media record:", mediaId);
        }
      }

      const { data, error } = await supabase
        .from(DB.stories.table)
        .insert({
          [DB.stories.authorId]: userId,
          [DB.stories.mediaId]: mediaId,
          [DB.stories.expiresAt]: expiresAt.toISOString(),
          [DB.stories.visibility]: "public",
          [DB.stories.viewCount]: 0,
          [DB.stories.viewersCount]: 0,
        })
        .select()
        .single();

      if (error) throw error;

      console.log("[Stories] Story created:", data?.id, "with media:", mediaId);
      return data;
    } catch (error) {
      console.error("[Stories] createStory error:", error);
      throw error;
    }
  },
  /**
   * Delete story (only owner can delete)
   */
  async deleteStory(storyId: string) {
    try {
      console.log("[Stories] deleteStory:", storyId);

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Only delete if user owns the story
      const { error } = await supabase
        .from(DB.stories.table)
        .delete()
        .eq(DB.stories.id, storyId)
        .eq(DB.stories.authorId, userId);

      if (error) throw error;
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

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from(DB.stories.table)
        .update({
          ...(updates.visibility && {
            [DB.stories.visibility]: updates.visibility,
          }),
        })
        .eq(DB.stories.id, storyId)
        .eq(DB.stories.authorId, userId)
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
