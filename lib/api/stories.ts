/**
 * Stories API - fetches real story data from Payload CMS
 */

import { stories as storiesApi } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

export interface Story {
  id: string;
  username: string;
  avatar: string;
  isViewed: boolean;
  items: Array<{
    id: string;
    type: "image" | "video" | "text";
    url?: string;
    text?: string;
    textColor?: string;
    backgroundColor?: string;
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
      (item) => {
        // Handle both direct url and media.url structures
        const media = item.media as Record<string, unknown> | undefined;
        const url = (item.url as string) || (media?.url as string) || (media as string);
        
        return {
          id: (item.id as string) || `item-${Math.random()}`,
          type: (item.type as "image" | "video" | "text") || "image",
          url: url as string | undefined,
          text: item.text as string | undefined,
          textColor: item.textColor as string | undefined,
          backgroundColor: item.backgroundColor as string | undefined,
          duration: (item.duration as number) || 5000,
        };
      },
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
    items: Array<{
      type: string;
      url?: string;
      text?: string;
      textColor?: string;
      backgroundColor?: string;
    }>;
  }): Promise<Story> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        throw new Error("User must be logged in to create a story");
      }

      console.log("[storiesApi] Creating story with items:", data.items);
      const doc = await storiesApi.create({
        caption: `Story by ${user.username}`,
        items: data.items,
        author: user.id,
      });
      console.log("[storiesApi] Story created:", doc);
      return transformStory(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[storiesApi] createStory error:", error);
      throw error;
    }
  },
};
