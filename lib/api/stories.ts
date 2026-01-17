/**
 * Stories API - fetches real story data from Payload CMS
 */

import { stories as storiesApi } from "@/lib/api-client";

export interface Story {
  id: string;
  username: string;
  avatar: string;
  isViewed: boolean;
  items: Array<{
    id: string;
    type: "image" | "video";
    url: string;
    duration?: number;
  }>;
}

// Transform API response to match Story type
function transformStory(doc: Record<string, unknown>): Story {
  const author = doc.author as Record<string, unknown> | undefined;

  return {
    id: doc.id as string,
    username: (author?.username as string) || "user",
    avatar:
      (author?.avatar as string) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent((author?.name as string) || "User")}`,
    isViewed: (doc.viewed as boolean) || false,
    items: ((doc.items as Array<Record<string, unknown>>) || []).map(
      (item) => ({
        id: (item.id as string) || `item-${Math.random()}`,
        type: (item.type as "image" | "video") || "image",
        url: (item.url as string) || "",
        duration: item.duration as number,
      }),
    ),
  };
}

export const storiesApiClient = {
  // Fetch all active stories
  async getStories(): Promise<Story[]> {
    try {
      const response = await storiesApi.find({ limit: 30 });
      return response.docs.map(transformStory);
    } catch (error) {
      console.error("[storiesApi] getStories error:", error);
      return [];
    }
  },

  // Create a new story
  async createStory(data: {
    items: Array<{ type: string; url: string }>;
  }): Promise<Story> {
    try {
      const doc = await storiesApi.create({
        items: data.items,
        viewed: false,
      });
      return transformStory(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[storiesApi] createStory error:", error);
      throw error;
    }
  },
};
