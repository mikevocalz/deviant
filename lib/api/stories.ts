/**
 * Stories API - fetches real story data from Payload CMS
 */

import { useAuthStore } from "@/lib/stores/auth-store";
import { Platform } from "react-native";

// Helper to extract avatar URL from various formats
function extractAvatarUrl(avatar: unknown, fallbackName?: string): string {
  if (!avatar) {
    // Generate fallback avatar
    return fallbackName
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`
      : "";
  }
  if (typeof avatar === "string") return avatar;
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;
    if (avatarObj.url && typeof avatarObj.url === "string") {
      return avatarObj.url;
    }
  }
  return "";
}

// Cache for user ID lookups to avoid repeated API calls
const userIdCache: Record<string, string> = {};

// Get JWT token from storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync("dvnt_auth_token");
  } catch {
    return null;
  }
}

// Helper function to lookup user ID by username using Payload custom endpoint
async function getUserIdByUsername(username: string): Promise<string | null> {
  if (!username) return null;

  // Check cache first
  if (userIdCache[username]) {
    return userIdCache[username];
  }

  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return null;

    const token = await getAuthToken();

    // Use custom profile endpoint (returns JSON)
    const response = await fetch(`${apiUrl}/api/users/${username}/profile`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) return null;

    const profile = await response.json();
    if (profile && profile.id) {
      const userId = String(profile.id);
      userIdCache[username] = userId;
      return userId;
    }
  } catch (error) {
    console.error("[storiesApi] getUserIdByUsername error:", error);
  }

  return null;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  isViewed: boolean;
  items: Array<{
    id: string;
    type: "image" | "video" | "text";
    url?: string;
    thumbnailUrl?: string; // Poster image for videos
    text?: string;
    textColor?: string;
    backgroundColor?: string;
    duration?: number;
  }>;
}

// Transform API response to match Story type
function transformStory(doc: Record<string, unknown>): Story {
  // Author can be a populated object OR just an ID string
  const authorRaw = doc.author;
  let authorId = "";
  let authorUsername = "user";
  let authorName = "User";
  let authorAvatar = ""; // Will be set properly below

  if (typeof authorRaw === "object" && authorRaw !== null) {
    // Author is a populated object
    const author = authorRaw as Record<string, unknown>;
    authorId = String(author.id || "");
    authorUsername = (author.username as string) || "user";
    authorName =
      (author.name as string) || (author.username as string) || "User";
    // CRITICAL: Avatar might be a media object with url, not a string
    authorAvatar = extractAvatarUrl(author.avatar, authorName);
  } else if (typeof authorRaw === "string" && authorRaw) {
    // Author is just an ID string (not populated)
    authorId = authorRaw;
    console.warn("[storiesApi] Author not populated, only ID:", authorId);
  } else if (typeof authorRaw === "number") {
    // Author is a numeric ID
    authorId = String(authorRaw);
    console.warn("[storiesApi] Author is numeric ID:", authorId);
  }

  // Fallback to externalAuthorId if author.id is missing
  if (!authorId && doc.externalAuthorId) {
    authorId = String(doc.externalAuthorId);
    console.log("[storiesApi] Using externalAuthorId:", authorId);
  }

  // Ensure authorAvatar has a proper fallback
  if (!authorAvatar || authorAvatar === "") {
    authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=3EA4E5&color=fff`;
  }

  const rawItems = (doc.items as Array<Record<string, unknown>>) || [];

  const transformedItems = rawItems.map((item) => {
    // Handle multiple possible URL structures from CMS
    const media = item.media as Record<string, unknown> | undefined;
    let url: string | undefined;
    let thumbnailUrl: string | undefined;

    // Try different URL locations
    if (typeof item.url === "string" && item.url) {
      url = item.url;
    } else if (media && typeof media.url === "string" && media.url) {
      url = media.url;
    } else if (typeof media === "string" && media) {
      url = media;
    }

    // Get thumbnail/poster for video items
    if (typeof item.thumbnailUrl === "string" && item.thumbnailUrl) {
      thumbnailUrl = item.thumbnailUrl;
    } else if (
      media &&
      typeof media.thumbnailUrl === "string" &&
      media.thumbnailUrl
    ) {
      thumbnailUrl = media.thumbnailUrl;
    } else if (
      media &&
      typeof media.thumbnail === "string" &&
      media.thumbnail
    ) {
      thumbnailUrl = media.thumbnail;
    }

    // Validate URL - must be valid HTTP/HTTPS
    const isValidUrl =
      url && (url.startsWith("http://") || url.startsWith("https://"));

    return {
      id: (item.id as string) || `item-${Math.random()}`,
      type: (item.type as "image" | "video" | "text") || "image",
      url: isValidUrl ? url : undefined,
      thumbnailUrl, // Poster image for videos
      text: item.text as string | undefined,
      textColor: item.textColor as string | undefined,
      backgroundColor: item.backgroundColor as string | undefined,
      duration: (item.duration as number) || 5000,
    };
  });

  const story: Story = {
    id: String(doc.id),
    userId: authorId,
    username: authorUsername,
    avatar:
      authorAvatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}`,
    isViewed: (doc.viewed as boolean) || false,
    items: transformedItems,
  };

  // Debug: Log story with items for troubleshooting
  console.log("[storiesApi] Transformed story:", {
    id: story.id,
    userId: story.userId,
    username: story.username,
    hasAvatar: !!story.avatar,
    itemCount: transformedItems.length,
    firstItemUrl: transformedItems[0]?.url?.slice(0, 50),
  });

  return story;
}

export const storiesApiClient = {
  // Fetch all active stories (uses custom endpoint)
  async getStories(): Promise<Story[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      const response = await fetch(`${apiUrl}/api/stories?limit=30`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        console.error("[storiesApi] getStories failed:", response.status);
        return [];
      }

      const result = await response.json();
      console.log(
        "[storiesApi] Raw stories response count:",
        result.docs?.length || 0,
      );

      // Log first story structure for debugging
      if (result.docs?.[0]) {
        const first = result.docs[0] as Record<string, unknown>;
        console.log("[storiesApi] First story structure:", {
          id: first.id,
          hasItems: Array.isArray(first.items),
          itemCount: Array.isArray(first.items) ? first.items.length : 0,
          createdAt: first.createdAt,
          authorId:
            typeof first.author === "object"
              ? (first.author as any)?.id
              : first.author,
        });
      }

      return (result.docs || []).map(transformStory);
    } catch (error) {
      console.error("[storiesApi] getStories error:", error);
      return [];
    }
  },

  // Create a new story (uses custom endpoint)
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
      console.log("[storiesApi] User:", {
        id: user.id,
        username: user.username,
      });

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(`${apiUrl}/api/stories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          media: data.items[0], // Endpoint expects single media object
          items: data.items, // Also send full items array
          clientMutationId: `story-${Date.now()}-${Math.random()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to create story: ${response.status}`,
        );
      }

      const doc = await response.json();
      console.log("[storiesApi] Story created successfully:", doc);
      return transformStory(doc as Record<string, unknown>);
    } catch (error: any) {
      console.error("[storiesApi] createStory error:", error);
      console.error(
        "[storiesApi] Error details:",
        JSON.stringify(error, null, 2),
      );
      const errorMessage =
        error?.message ||
        error?.error?.message ||
        error?.error ||
        "Failed to create story";
      throw new Error(errorMessage);
    }
  },
};
