/**
 * Stories API - fetches real story data from Payload CMS
 */

import { stories as storiesApi, users } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

// Cache for user ID lookups to avoid repeated API calls
const userIdCache: Record<string, string> = {};

// Extract avatar URL from various possible formats (upload field returns object with url)
function extractAvatarUrl(avatar: unknown, fallbackName: string): string {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=3EA4E5&color=fff`;

  if (!avatar) return fallback;

  // If it's already a valid URL string
  if (
    typeof avatar === "string" &&
    (avatar.startsWith("http://") || avatar.startsWith("https://"))
  ) {
    return avatar;
  }

  // If it's a media object with url property (from Payload upload field with depth)
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;
    if (avatarObj.url && typeof avatarObj.url === "string") {
      return avatarObj.url;
    }
  }

  return fallback;
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
  // Fetch all active stories (not expired - within 24 hours)
  async getStories(): Promise<Story[]> {
    try {
      // Calculate 24 hours ago for expiry filter
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const response = await storiesApi.find({
        limit: 50,
        depth: 2,
        sort: "-createdAt", // Newest first
        where: {
          // Only fetch stories created within the last 24 hours
          createdAt: {
            greater_than: twentyFourHoursAgo,
          },
        },
      });
      console.log(
        "[storiesApi] Raw stories response count:",
        response.docs?.length || 0,
        "| 24h filter:",
        twentyFourHoursAgo,
      );

      // Log first story structure for debugging
      if (response.docs?.[0]) {
        const first = response.docs[0] as Record<string, unknown>;
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

      // Filter and transform - ensure each story has valid items
      const transformed = response.docs
        .map(transformStory)
        .filter((story) => story.items && story.items.length > 0);

      console.log(
        "[storiesApi] Transformed stories count:",
        transformed.length,
      );
      return transformed;
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
      console.log("[storiesApi] User:", {
        id: user.id,
        username: user.username,
      });

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
              console.warn(
                "[storiesApi] User not found in CMS:",
                user.username,
              );
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

      console.log(
        "[storiesApi] Story data being sent:",
        JSON.stringify(storyData, null, 2),
      );

      const doc = await storiesApi.create(storyData);
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
