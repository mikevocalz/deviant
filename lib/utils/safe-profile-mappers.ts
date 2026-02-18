/**
 * Safe Profile Mappers
 *
 * PHASE 2: Defensive data mappers that NEVER throw
 * These ensure Profile screen cannot crash from malformed data
 */

import type { Post } from "@/lib/types";

/**
 * Safe profile data with guaranteed non-null values
 */
export interface SafeProfileData {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string | null;
  website: string | null;
  location: string | null;
  hashtags: string[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  // Flag for unknown/invalid data
  _isPlaceholder: boolean;
}

/**
 * Safe grid tile with guaranteed structure
 */
export interface SafeGridTile {
  id: string;
  kind: "image" | "carousel" | "video";
  coverUrl: string | null;
  videoUrl: string | null;
  mediaCount: number;
  // Flag for invalid tiles that should not be rendered
  _isValid: boolean;
}

/**
 * safeProfile - Converts any profile-like object to SafeProfileData
 * NEVER throws - always returns valid object
 */
export function safeProfile(profileData: any, authUser: any): SafeProfileData {
  try {
    // Try profile data first, then authUser fallback
    const source = profileData || authUser || {};

    return {
      id: String(source.id || authUser?.id || ""),
      username: String(source.username || authUser?.username || ""),
      displayName: String(
        source.displayName ||
          source.name ||
          authUser?.name ||
          authUser?.displayName ||
          "User",
      ),
      bio: String(source.bio || authUser?.bio || ""),
      avatar: extractAvatarSafe(source) || extractAvatarSafe(authUser),
      website: source.website || authUser?.website || null,
      location: source.location || authUser?.location || null,
      hashtags: Array.isArray(source.hashtags)
        ? source.hashtags
        : Array.isArray(authUser?.hashtags)
          ? authUser.hashtags
          : [],
      followersCount: safeNumber(
        source.followersCount ?? authUser?.followersCount,
      ),
      followingCount: safeNumber(
        source.followingCount ?? authUser?.followingCount,
      ),
      postsCount: safeNumber(source.postsCount ?? authUser?.postsCount),
      isVerified: Boolean(
        source.verified || source.isVerified || authUser?.isVerified,
      ),
      _isPlaceholder: !source.id && !authUser?.id,
    };
  } catch (error) {
    console.error("[safeProfile] Error mapping profile data:", error);
    // Return absolute minimum placeholder
    return {
      id: "",
      username: "",
      displayName: "User",
      bio: "",
      avatar: null,
      website: null,
      location: null,
      hashtags: [],
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      isVerified: false,
      _isPlaceholder: true,
    };
  }
}

/**
 * safeGridTile - Converts any post-like object to SafeGridTile
 * NEVER throws - always returns valid object
 */
export function safeGridTile(post: any): SafeGridTile {
  try {
    // Invalid post check
    if (!post || typeof post !== "object") {
      return {
        id: "",
        kind: "image",
        coverUrl: null,
        videoUrl: null,
        mediaCount: 0,
        _isValid: false,
      };
    }

    const postId = post.id;
    if (!postId) {
      return {
        id: "",
        kind: "image",
        coverUrl: null,
        videoUrl: null,
        mediaCount: 0,
        _isValid: false,
      };
    }

    const media = Array.isArray(post.media) ? post.media : [];
    const mediaCount = media.length;

    // Determine kind
    let kind: "image" | "carousel" | "video" = "image";
    if (mediaCount > 1) {
      kind = "carousel";
    } else if (media[0]?.type === "video") {
      kind = "video";
    }

    // Extract cover URL with fallbacks
    // For video posts, transformPost puts the thumbnail image URL on the
    // post-level `thumbnail` field (separate from media[0] which is the video).
    let coverUrl: string | null = null;
    if (kind === "video") {
      coverUrl =
        post.thumbnail || media[0]?.posterUrl || media[0]?.thumbnail || null;
    } else {
      coverUrl = media[0]?.thumbnail || media[0]?.url || null;
    }

    // Validate URL format
    if (coverUrl && typeof coverUrl === "string") {
      if (!coverUrl.startsWith("http://") && !coverUrl.startsWith("https://")) {
        coverUrl = null;
      }
    } else {
      coverUrl = null;
    }

    // For video posts, preserve the video URL for client-side thumbnail generation
    const videoUrl =
      kind === "video" && media[0]?.url ? String(media[0].url) : null;

    return {
      id: String(postId),
      kind,
      coverUrl,
      videoUrl,
      mediaCount,
      _isValid: true,
    };
  } catch (error) {
    console.error("[safeGridTile] Error mapping post:", error);
    return {
      id: String(post?.id || ""),
      kind: "image",
      coverUrl: null,
      videoUrl: null,
      mediaCount: 0,
      _isValid: false,
    };
  }
}

/**
 * safeGridTiles - Maps array of posts to safe grid tiles
 * NEVER throws - filters out invalid tiles
 */
export function safeGridTiles(posts: any): SafeGridTile[] {
  try {
    if (!posts || !Array.isArray(posts)) {
      return [];
    }
    return posts.map(safeGridTile).filter((tile) => tile._isValid && tile.id);
  } catch (error) {
    console.error("[safeGridTiles] Error mapping posts:", error);
    return [];
  }
}

/**
 * Extract avatar URL safely from various formats
 */
function extractAvatarSafe(obj: any): string | null {
  try {
    if (!obj) return null;

    // Direct string URL
    if (typeof obj.avatar === "string" && obj.avatar.startsWith("http")) {
      return obj.avatar;
    }
    if (typeof obj.avatarUrl === "string" && obj.avatarUrl.startsWith("http")) {
      return obj.avatarUrl;
    }

    // Media object with url
    if (obj.avatar?.url && typeof obj.avatar.url === "string") {
      return obj.avatar.url;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Safe number extraction - never NaN, always >= 0
 */
function safeNumber(value: any): number {
  if (typeof value === "number" && !isNaN(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0;
}

/**
 * Safe bookmarks extraction - always returns string array
 */
export function safeBookmarkIds(
  queryData: any,
  storeGetter: () => string[],
): string[] {
  try {
    // First try query data
    if (Array.isArray(queryData) && queryData.length > 0) {
      return queryData.filter((id) => typeof id === "string" && id.length > 0);
    }

    // Then try store
    const storeData = storeGetter();
    if (Array.isArray(storeData)) {
      return storeData.filter((id) => typeof id === "string" && id.length > 0);
    }

    return [];
  } catch (error) {
    console.error("[safeBookmarkIds] Error getting bookmarks:", error);
    return [];
  }
}

/**
 * Format count safely for display (e.g., 24800 -> "24.8K")
 */
export function formatCountSafe(count: any): string {
  try {
    const num = safeNumber(count);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  } catch {
    return "0";
  }
}
