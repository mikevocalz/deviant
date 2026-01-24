/**
 * Stories API - fetches real story data from Payload CMS
 */

import { stories as storiesApi, users } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

// Cache for user ID lookups to avoid repeated API calls
const userIdCache: Record<string, string> = {};

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
  const rawItems = (doc.items as Array<Record<string, unknown>>) || [];

  const transformedItems = rawItems.map((item) => {
    // Handle multiple possible URL structures from CMS
    const media = item.media as Record<string, unknown> | undefined;
    let url: string | undefined;
    
    // Try different URL locations
    if (typeof item.url === 'string' && item.url) {
      url = item.url;
    } else if (media && typeof media.url === 'string' && media.url) {
      url = media.url;
    } else if (typeof media === 'string' && media) {
      url = media;
    }
    
    return {
      id: (item.id as string) || `item-${Math.random()}`,
      type: (item.type as "image" | "video" | "text") || "image",
      url,
      text: item.text as string | undefined,
      textColor: item.textColor as string | undefined,
      backgroundColor: item.backgroundColor as string | undefined,
      duration: (item.duration as number) || 5000,
    };
  });

  const story: Story = {
    id: String(doc.id),
    username: (author?.username as string) || "user",
    avatar:
      (author?.avatar as string) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent((author?.name as string) || "User")}`,
    isViewed: (doc.viewed as boolean) || false,
    items: transformedItems,
  };

  // Debug: Log story with items for troubleshooting
  if (transformedItems.length > 0) {
    console.log("[storiesApi] Transformed story:", {
      id: story.id,
      username: story.username,
      itemCount: transformedItems.length,
      firstItemUrl: transformedItems[0]?.url?.slice(0, 50),
    });
  }

  return story;
}

export const storiesApiClient = {
  // Fetch all active stories
  async getStories(): Promise<Story[]> {
    try {
      const response = await storiesApi.find({ limit: 30, depth: 2 });
      console.log("[storiesApi] Raw stories response count:", response.docs?.length || 0);
      
      // Log first story structure for debugging
      if (response.docs?.[0]) {
        const first = response.docs[0] as Record<string, unknown>;
        console.log("[storiesApi] First story structure:", {
          id: first.id,
          hasItems: Array.isArray(first.items),
          itemCount: Array.isArray(first.items) ? first.items.length : 0,
          firstItem: Array.isArray(first.items) && first.items[0] ? JSON.stringify(first.items[0]).slice(0, 200) : null,
        });
      }
      
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
      console.log("[storiesApi] User:", { id: user.id, username: user.username });
      
      // Look up the Payload CMS user ID by username
      let authorId: string | undefined;
      
      if (user.username) {
        // Check cache first
        if (userIdCache[user.username]) {
          authorId = userIdCache[user.username];
          console.log("[storiesApi] Using cached author ID:", authorId);
        } else {
          // Look up user in Payload CMS
          try {
            const userResult = await users.find({
              where: { username: { equals: user.username } },
              limit: 1,
            });
            
            if (userResult.docs && userResult.docs.length > 0) {
              authorId = (userResult.docs[0] as { id: string }).id;
              userIdCache[user.username] = authorId;
              console.log("[storiesApi] Found author ID:", authorId);
            } else {
              console.warn("[storiesApi] User not found in CMS:", user.username);
            }
          } catch (lookupError) {
            console.error("[storiesApi] User lookup error:", lookupError);
          }
        }
      }
      
      const storyData = {
        caption: `Story by ${user.username}`,
        items: data.items,
        author: authorId, // Use the looked-up Payload CMS user ID
      };
      
      console.log("[storiesApi] Story data being sent:", JSON.stringify(storyData, null, 2));
      
      const doc = await storiesApi.create(storyData);
      console.log("[storiesApi] Story created successfully:", doc);
      return transformStory(doc as Record<string, unknown>);
    } catch (error: any) {
      console.error("[storiesApi] createStory error:", error);
      console.error("[storiesApi] Error details:", JSON.stringify(error, null, 2));
      const errorMessage = error?.message || error?.error?.message || error?.error || "Failed to create story";
      throw new Error(errorMessage);
    }
  },
};
