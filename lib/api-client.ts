/**
 * Client-side API utilities for Expo app
 *
 * OPTION A: DIRECT-TO-PAYLOAD ONLY
 * All API calls go directly to Payload CMS.
 * No Expo API routes. No proxies. No mixed calls.
 *
 * Architecture:
 * This Client → Payload CMS (direct)
 */

import { getAuthCookies } from "@/lib/auth-client";
import { Platform } from "react-native";

// CRITICAL: Import canonical API URL resolver - single source of truth
import { getPayloadBaseUrl, validateApiConfig } from "@/lib/api-config";

// OPTION A: ONE backend URL - Payload CMS
const PAYLOAD_URL = getPayloadBaseUrl();

// Validate configuration at module load
validateApiConfig();

// Hard guard - fail fast if configuration is invalid
if (!PAYLOAD_URL || !PAYLOAD_URL.startsWith("https://")) {
  throw new Error(
    `[API] CRITICAL: Invalid API configuration. PAYLOAD_URL="${PAYLOAD_URL}" is not a valid HTTPS URL. Check environment variables.`,
  );
}

// ============================================================
// PHASE 1 INSTRUMENTATION: Log API base at startup
// ============================================================
console.log("[API] ========================================");
console.log("[API] STARTUP INSTRUMENTATION");
console.log("[API] API_BASE:", PAYLOAD_URL);
console.log("[API] /users/me endpoint:", `${PAYLOAD_URL}/api/users/me`);
console.log("[API] Platform:", Platform.OS);
console.log("[API] ========================================");

/**
 * Join URL parts safely, preventing // and /api/api issues
 * Option A: PAYLOAD_URL has NO /api suffix, all endpoints start with /api
 */
function joinUrl(base: string, path: string): string {
  // Remove trailing slash from base
  const cleanBase = base.replace(/\/+$/, "");
  // Ensure path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Prevent double /api
  if (cleanBase.endsWith("/api") && cleanPath.startsWith("/api")) {
    return `${cleanBase}${cleanPath.slice(4)}`;
  }
  return `${cleanBase}${cleanPath}`;
}

// Get JWT token from storage - MUST match auth-client.ts storage methods
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    const token = await SecureStore.getItemAsync("dvnt_auth_token");
    return token || null;
  } catch (e) {
    console.error("[API] getAuthToken error:", e);
    return null;
  }
}

// Types matching Payload paginated responses
export interface PaginatedResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export interface APIError {
  error: string;
  errors?: Array<{ message: string; field?: string }>;
}

// Query options for find operations
export interface FindParams {
  limit?: number;
  page?: number;
  depth?: number;
  sort?: string;
  where?: Record<string, unknown>;
}

// Serialize where clause to Payload bracket notation
// e.g., { author: { equals: "15" } } => "where[author][equals]=15"
function serializeWhereClause(
  where: Record<string, unknown>,
  prefix = "where",
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(where)) {
    const fullKey = `${prefix}[${key}]`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      parts.push(
        serializeWhereClause(value as Record<string, unknown>, fullKey),
      );
    } else {
      parts.push(
        `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`,
      );
    }
  }

  return parts.join("&");
}

// Build query string from params
function buildQueryString(params: FindParams): string {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined)
    searchParams.set("limit", String(params.limit));
  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.depth !== undefined)
    searchParams.set("depth", String(params.depth));
  if (params.sort) searchParams.set("sort", params.sort);

  let queryString = searchParams.toString();

  // Add where clause in bracket notation (Payload CMS format)
  if (params.where) {
    const whereString = serializeWhereClause(params.where);
    queryString = queryString ? `${queryString}&${whereString}` : whereString;
  }

  return queryString ? `?${queryString}` : "";
}

// Base fetch with error handling - ALL requests go to Payload CMS
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Use joinUrl to prevent // and /api/api issues
  const url = joinUrl(PAYLOAD_URL, endpoint);

  // Get auth token and cookies for authenticated requests
  const authToken = await getAuthToken();
  const authCookies = getAuthCookies();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Use JWT token for authorization (preferred for Payload CMS)
  if (authToken) {
    headers["Authorization"] = `JWT ${authToken}`;
  }

  // Pass auth cookies in header for cross-origin requests (production)
  if (authCookies) {
    headers["Cookie"] = authCookies;
  }

  // ============================================================
  // PHASE 1 INSTRUMENTATION: Log EVERY request
  // ============================================================
  const method = options.method || "GET";
  console.log(`[API] REQUEST: ${method} ${url}`);
  console.log(`[API]   hasAuth: ${!!authToken}`);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "omit", // Always cross-origin to Payload CMS
    });
  } catch (networkError: any) {
    console.error(`[API] NETWORK ERROR: ${networkError.message}`);
    throw networkError;
  }

  let data: any;
  const contentType = response.headers.get("content-type");
  let responseText = "";

  if (contentType?.includes("application/json")) {
    data = await response.json();
    responseText = JSON.stringify(data).slice(0, 200);
  } else {
    // Handle non-JSON responses (HTML error pages, etc)
    const text = await response.text();
    responseText = text.slice(0, 200);
    console.error("[API] Non-JSON response:", responseText);
    data = { error: `Server returned non-JSON response (${response.status})` };
  }

  // Log response status and body preview
  console.log(`[API]   status: ${response.status}`);
  console.log(`[API]   body: ${responseText}`);

  if (!response.ok) {
    const error = new Error(
      data?.errors?.[0]?.message ||
        (data as APIError).error ||
        data?.message ||
        `API error: ${response.status}`,
    ) as Error & {
      status: number;
      errors?: Array<{ message: string; field?: string }>;
    };
    error.status = response.status;
    error.errors = (data as APIError).errors || data?.errors;
    throw error;
  }

  return data as T;
}

// Payload fetch - alias for apiFetch (OPTION A: they're the same)
// Kept for backward compatibility with existing code
async function payloadFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Simply delegate to apiFetch - no code duplication
  return apiFetch<T>(endpoint, options);
}

/**
 * Posts API
 *
 * @example
 * // Get paginated posts
 * const { docs, totalPages } = await posts.find({ limit: 10, page: 1 })
 *
 * // Get single post
 * const post = await posts.findByID('abc123')
 *
 * // Create post
 * const newPost = await posts.create({ title: 'Hello', content: '...' })
 */
export const posts = {
  find: <T = Record<string, unknown>>(params: FindParams = {}) =>
    apiFetch<PaginatedResponse<T>>(`/api/posts${buildQueryString(params)}`),

  findByID: <T = Record<string, unknown>>(id: string, depth?: number) =>
    apiFetch<T>(`/api/posts/${id}${depth ? `?depth=${depth}` : ""}`),

  create: <T = Record<string, unknown>>(data: Record<string, unknown>) =>
    apiFetch<T>("/api/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: <T = Record<string, unknown>>(
    id: string,
    data: Record<string, unknown>,
  ) =>
    apiFetch<T>(`/api/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: <T = Record<string, unknown>>(id: string) =>
    apiFetch<T>(`/api/posts/${id}`, { method: "DELETE" }),
};

/**
 * Users API
 *
 * @example
 * // Get current user
 * const { user } = await users.me()
 *
 * // Register new user
 * const newUser = await users.register({ email: '...', password: '...' })
 */
export const users = {
  find: <T = Record<string, unknown>>(params: FindParams = {}) =>
    apiFetch<PaginatedResponse<T>>(`/api/users${buildQueryString(params)}`),

  findByID: <T = Record<string, unknown>>(id: string, depth?: number) =>
    apiFetch<T>(`/api/users/${id}${depth ? `?depth=${depth}` : ""}`),

  findByUsername: async <T = Record<string, unknown>>(
    username: string,
    depth?: number,
  ): Promise<T | null> => {
    try {
      const result = await users.find<T>({
        where: { username: { equals: username.toLowerCase() } },
        limit: 1,
        depth: depth || 1,
      });
      return result.docs?.[0] || null;
    } catch (error) {
      console.error("[users] findByUsername error:", error);
      return null;
    }
  },

  me: <T = Record<string, unknown>>() =>
    apiFetch<{ user: T | null }>("/api/users/me"),

  updateMe: async <T = Record<string, unknown>>(data: {
    name?: string;
    bio?: string;
    website?: string;
    avatar?: string;
    username?: string;
    location?: string;
    hashtags?: string[];
  }): Promise<{ user: T }> => {
    console.log("[API] updateMe called with:", JSON.stringify(data));
    try {
      const res = await apiFetch<{ user: T }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      console.log("[API] updateMe success:", JSON.stringify(res));
      return res;
    } catch (error: any) {
      console.error("[API] updateMe error:", error?.message, error);
      throw error;
    }
  },

  register: <T = Record<string, unknown>>(data: {
    email: string;
    password: string;
    [key: string]: unknown;
  }) =>
    apiFetch<T>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkUsername: async (
    username: string,
  ): Promise<{
    available: boolean;
    suggestions: string[];
    error?: string;
  }> => {
    try {
      const response = await apiFetch<{
        available: boolean;
        suggestions: string[];
        error?: string;
      }>(`/api/users/check-username?username=${encodeURIComponent(username)}`);
      return response;
    } catch (error: any) {
      console.error("[users] checkUsername error:", error);
      // On error, assume available and let server validate at registration
      return { available: true, suggestions: [] };
    }
  },

  // CANONICAL: Use Payload v3 custom endpoints
  // POST /api/users/follow for follow, DELETE for unfollow
  follow: async (userId: string, action: "follow" | "unfollow") => {
    console.log("[users.follow] Calling Payload CMS:", { userId, action });
    return payloadFetch<{
      message: string;
      following: boolean;
      followersCount: number;
    }>("/api/users/follow", {
      method: action === "follow" ? "POST" : "DELETE",
      body: JSON.stringify({ followingId: userId }),
    });
  },

  // Get current user's following list (IDs of users they follow)
  // STABILIZED: Fetches from dedicated follows collection via Payload CMS
  getFollowing: async (): Promise<string[]> => {
    try {
      const currentUser = await users.me<{ id: string }>();
      if (!currentUser.user?.id) return [];

      // Fetch from follows collection via Payload CMS
      const response = await payloadFetch<{
        docs: Array<{ following: string | { id: string } }>;
      }>(
        `/api/follows?where[follower][equals]=${currentUser.user.id}&limit=1000`,
      );

      if (!response.docs) return [];

      return response.docs
        .map((follow: any) => {
          const followingId = follow.following;
          if (typeof followingId === "string") return followingId;
          if (followingId?.id) return followingId.id;
          return null;
        })
        .filter(
          (id): id is string => !!id && id !== "undefined" && id !== "null",
        );
    } catch (error) {
      console.error("[users] getFollowing error:", error);
      return [];
    }
  },

  // CANONICAL: GET /api/users/:id/follow-state
  isFollowing: async (userId: string): Promise<boolean> => {
    try {
      const response = await payloadFetch<{ isFollowing: boolean }>(
        `/api/users/${userId}/follow-state`,
      );
      return response.isFollowing;
    } catch (error) {
      console.error("[users] isFollowing error:", error);
      return false;
    }
  },

  // CANONICAL: GET /api/users/:id/profile
  getProfile: async (userId: string) => {
    return payloadFetch<{
      id: string;
      username: string;
      displayName: string;
      bio: string;
      avatar: any;
      avatarUrl: string;
      followersCount: number;
      followingCount: number;
      postsCount: number;
      isFollowing: boolean;
      isFollowedBy: boolean;
      isOwnProfile: boolean;
    }>(`/api/users/${userId}/profile`);
  },

  // CANONICAL: GET /api/users/:id/posts
  getPosts: async (userId: string, page = 1, limit = 20) => {
    return payloadFetch<PaginatedResponse<any>>(
      `/api/users/${userId}/posts?page=${page}&limit=${limit}`,
    );
  },

  // CANONICAL: GET /api/users/me/bookmarks
  getBookmarks: async (): Promise<string[]> => {
    try {
      const response = await payloadFetch<{
        docs: Array<{ id: string }>;
      }>("/api/users/me/bookmarks?limit=1000");

      if (!response.docs) return [];

      return response.docs
        .map((post: any) => String(post.id))
        .filter(
          (id): id is string => !!id && id !== "undefined" && id !== "null",
        );
    } catch (error) {
      console.error("[users] getBookmarks error:", error);
      return [];
    }
  },

  // Get liked posts for current user
  // NOTE: This endpoint doesn't exist in the current backend - return empty silently
  getLikedPosts: async (): Promise<string[]> => {
    // The /api/users/me/likes endpoint doesn't exist on the backend yet
    // Return empty array silently to prevent error spam
    return [];
  },

  // Get followers list for a user (users who follow them)
  getFollowers: async (
    userId: string,
  ): Promise<
    Array<{
      id: string;
      username: string;
      name?: string;
      avatar?: string;
      isFollowing?: boolean;
    }>
  > => {
    try {
      // Fetch from follows collection - get users where following = userId
      const response = await payloadFetch<{
        docs: Array<{
          follower:
            | { id: string; username: string; name?: string; avatar?: string }
            | string;
        }>;
      }>(`/api/follows?where[following][equals]=${userId}&limit=100&depth=1`);

      if (!response.docs) return [];

      // Transform to user objects
      const followerUsers = response.docs
        .map((follow: any) => {
          const follower = follow.follower;
          if (typeof follower === "string") {
            return { id: follower, username: "User" };
          }
          if (follower?.id) {
            return {
              id: String(follower.id),
              username: follower.username || "User",
              name: follower.name,
              avatar:
                follower.avatar?.url || follower.avatarUrl || follower.avatar,
            };
          }
          return null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      return followerUsers;
    } catch (error) {
      console.error("[users] getFollowers error:", error);
      return [];
    }
  },

  // Get following list for a user (users they follow)
  getFollowingList: async (
    userId: string,
  ): Promise<
    Array<{
      id: string;
      username: string;
      name?: string;
      avatar?: string;
      isFollowing?: boolean;
    }>
  > => {
    try {
      // Fetch from follows collection - get users where follower = userId
      const response = await payloadFetch<{
        docs: Array<{
          following:
            | { id: string; username: string; name?: string; avatar?: string }
            | string;
        }>;
      }>(`/api/follows?where[follower][equals]=${userId}&limit=100&depth=1`);

      if (!response.docs) return [];

      // Transform to user objects
      const followingUsers = response.docs
        .map((follow: any) => {
          const following = follow.following;
          if (typeof following === "string") {
            return { id: following, username: "User" };
          }
          if (following?.id) {
            return {
              id: String(following.id),
              username: following.username || "User",
              name: following.name,
              avatar:
                following.avatar?.url ||
                following.avatarUrl ||
                following.avatar,
            };
          }
          return null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      return followingUsers;
    } catch (error) {
      console.error("[users] getFollowingList error:", error);
      return [];
    }
  },
};

/**
 * Generic collection API factory
 *
 * @example
 * const events = createCollectionAPI('events')
 * const { docs } = await events.find({ limit: 5 })
 */
export function createCollectionAPI<T = Record<string, unknown>>(
  collection: string,
) {
  return {
    find: (params: FindParams = {}) =>
      apiFetch<PaginatedResponse<T>>(
        `/api/${collection}${buildQueryString(params)}`,
      ),

    findByID: (id: string, depth?: number) =>
      apiFetch<T>(`/api/${collection}/${id}${depth ? `?depth=${depth}` : ""}`),

    create: (data: Record<string, unknown>) =>
      apiFetch<T>(`/api/${collection}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<T>(`/api/${collection}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiFetch<T>(`/api/${collection}/${id}`, { method: "DELETE" }),
  };
}

/**
 * Events API
 */
export const events = {
  find: <T = Record<string, unknown>>(
    params: FindParams & { category?: string } = {},
  ) => {
    const { category, ...rest } = params;
    const queryString = buildQueryString(rest);
    const categoryParam = category
      ? `${queryString ? "&" : "?"}category=${category}`
      : "";
    return apiFetch<PaginatedResponse<T>>(
      `/api/events${queryString}${categoryParam}`,
    );
  },

  findByID: <T = Record<string, unknown>>(id: string, depth?: number) =>
    apiFetch<T>(`/api/events/${id}${depth ? `?depth=${depth}` : ""}`),

  create: <T = Record<string, unknown>>(data: Record<string, unknown>) =>
    apiFetch<T>("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: <T = Record<string, unknown>>(
    id: string,
    data: Record<string, unknown>,
  ) =>
    apiFetch<T>(`/api/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: <T = Record<string, unknown>>(id: string) =>
    apiFetch<T>(`/api/events/${id}`, { method: "DELETE" }),
};

/**
 * Stories API - CANONICAL Payload v3 endpoints
 */
export const stories = {
  find: <T = Record<string, unknown>>(params: FindParams = {}) =>
    payloadFetch<PaginatedResponse<T>>(
      `/api/stories${buildQueryString(params)}`,
    ),

  // CANONICAL: GET /api/stories (grouped: my story + others)
  getGrouped: () =>
    payloadFetch<{
      myStories: { user: any; stories: any[] } | null;
      otherStories: Array<{ user: any; stories: any[]; hasUnviewed: boolean }>;
    }>("/api/stories"),

  create: <T = Record<string, unknown>>(data: {
    caption?: string;
    items?: Array<{
      type: string;
      url?: string;
      text?: string;
      textColor?: string;
      backgroundColor?: string;
    }>;
    author?: string;
    media?: { type: "image" | "video"; url: string; posterUrl?: string };
    clientMutationId?: string;
  }) =>
    payloadFetch<T>("/api/stories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // CANONICAL: POST /api/stories/:id/view (idempotent)
  view: (storyId: string) =>
    payloadFetch<{ viewed: boolean; deduplicated?: boolean }>(
      `/api/stories/${storyId}/view`,
      { method: "POST" },
    ),

  // CANONICAL: POST /api/stories/:id/reply (creates DM)
  reply: (storyId: string, text: string, clientMutationId?: string) =>
    payloadFetch<{ message: any; conversationId: string }>(
      `/api/stories/${storyId}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ text, clientMutationId }),
      },
    ),
};

/**
 * Notifications API - CANONICAL Payload v3 endpoints
 */
export const notifications = {
  find: <T = Record<string, unknown>>(params: FindParams = {}) =>
    payloadFetch<PaginatedResponse<T>>(
      `/api/notifications${buildQueryString(params)}`,
    ),

  // CANONICAL: GET /api/notifications
  get: (params: { page?: number; limit?: number; unread?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.unread) query.set("unread", "true");
    return payloadFetch<PaginatedResponse<any>>(
      `/api/notifications${query.toString() ? `?${query}` : ""}`,
    );
  },

  // CANONICAL: POST /api/notifications/:id/read
  markRead: (notificationId: string) =>
    payloadFetch<{ read: boolean }>(
      `/api/notifications/${notificationId}/read`,
      {
        method: "POST",
      },
    ),

  // CANONICAL: GET /api/badges
  getBadges: () =>
    payloadFetch<{ notificationsUnread: number; messagesUnread: number }>(
      "/api/badges",
    ),

  // CANONICAL: POST /api/devices/register
  registerDevice: (
    deviceId: string,
    expoPushToken: string,
    platform?: string,
  ) =>
    payloadFetch<{ registered: boolean; deviceId: string }>(
      "/api/devices/register",
      {
        method: "POST",
        body: JSON.stringify({ deviceId, expoPushToken, platform }),
      },
    ),
};

/**
 * Likes API - CANONICAL Payload v3 endpoints
 */
export const likes = {
  // CANONICAL: POST /api/posts/:id/like (idempotent)
  likePost: (postId: string) =>
    payloadFetch<{ liked: boolean; likesCount: number }>(
      `/api/posts/${postId}/like`,
      { method: "POST" },
    ),

  // CANONICAL: DELETE /api/posts/:id/like (idempotent)
  unlikePost: (postId: string) =>
    payloadFetch<{ liked: boolean; likesCount: number }>(
      `/api/posts/${postId}/like`,
      { method: "DELETE" },
    ),

  // CANONICAL: GET /api/posts/:id/like-state
  getLikeState: (postId: string) =>
    payloadFetch<{ liked: boolean; likesCount: number }>(
      `/api/posts/${postId}/like-state`,
    ),

  // CANONICAL: POST /api/comments/:id/like (idempotent)
  likeComment: (commentId: string) =>
    payloadFetch<{ liked: boolean; likesCount: number }>(
      `/api/comments/${commentId}/like`,
      { method: "POST" },
    ),

  // CANONICAL: DELETE /api/comments/:id/like (idempotent)
  unlikeComment: (commentId: string) =>
    payloadFetch<{ liked: boolean; likesCount: number }>(
      `/api/comments/${commentId}/like`,
      { method: "DELETE" },
    ),
};

/**
 * Bookmarks API - CANONICAL Payload v3 endpoints
 */
export const bookmarks = {
  // CANONICAL: POST /api/posts/:id/bookmark (idempotent)
  bookmark: (postId: string) =>
    payloadFetch<{ bookmarked: boolean; bookmarkId?: string }>(
      `/api/posts/${postId}/bookmark`,
      { method: "POST" },
    ),

  // CANONICAL: DELETE /api/posts/:id/bookmark (idempotent)
  unbookmark: (postId: string) =>
    payloadFetch<{ bookmarked: boolean }>(`/api/posts/${postId}/bookmark`, {
      method: "DELETE",
    }),

  // CANONICAL: GET /api/posts/:id/bookmark-state
  getState: (postId: string) =>
    payloadFetch<{ bookmarked: boolean; bookmarkId?: string }>(
      `/api/posts/${postId}/bookmark-state`,
    ),

  // CANONICAL: GET /api/users/me/bookmarks
  getAll: (page = 1, limit = 20) =>
    payloadFetch<PaginatedResponse<any>>(
      `/api/users/me/bookmarks?page=${page}&limit=${limit}`,
    ),
};

/**
 * Messaging API - CANONICAL Payload v3 endpoints
 */
export const messaging = {
  // CANONICAL: POST /api/conversations/direct (idempotent via directKey)
  createDirect: (userId: string) =>
    payloadFetch<any>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  // CANONICAL: POST /api/conversations/group
  createGroup: (participantIds: string[], name?: string) =>
    payloadFetch<any>("/api/conversations/group", {
      method: "POST",
      body: JSON.stringify({ participantIds, name }),
    }),

  // CANONICAL: GET /api/conversations?box=inbox|spam
  getConversations: (box: "inbox" | "spam" = "inbox") =>
    payloadFetch<{ docs: any[]; totalDocs: number; box: string }>(
      `/api/conversations?box=${box}`,
    ),

  // CANONICAL: GET /api/conversations/:id/messages
  getMessages: (conversationId: string, page = 1, limit = 50) =>
    payloadFetch<PaginatedResponse<any>>(
      `/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    ),

  // CANONICAL: POST /api/conversations/:id/messages (dedupe by clientMutationId)
  sendMessage: (
    conversationId: string,
    text: string,
    clientMutationId?: string,
    media?: any,
  ) =>
    payloadFetch<any>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, clientMutationId, media }),
    }),

  // CANONICAL: POST /api/conversations/:id/read
  markRead: (conversationId: string) =>
    payloadFetch<{ read: boolean }>(
      `/api/conversations/${conversationId}/read`,
      {
        method: "POST",
      },
    ),
};

/**
 * Comments API - uses Payload custom endpoints
 */
export const comments = {
  findByPost: <T = Record<string, unknown>>(
    postId: string,
    params: FindParams = {},
  ) => {
    // Use Payload custom endpoint: GET /api/posts/:id/comments
    // This returns comments with nested replies already attached
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.page) searchParams.set("page", String(params.page));
    const queryString = searchParams.toString();
    return apiFetch<PaginatedResponse<T>>(
      `/api/posts/${postId}/comments${queryString ? `?${queryString}` : ""}`,
    );
  },

  findByParent: <T = Record<string, unknown>>(
    parentId: string,
    postId: string,
    params: FindParams = {},
  ) => {
    // Replies are already included in findByPost response
    // This is kept for backwards compatibility but returns empty
    // The custom endpoint nests replies under each comment
    console.log(
      "[API] findByParent called - replies are nested in findByPost response",
    );
    return Promise.resolve({
      docs: [],
      totalDocs: 0,
      limit: 0,
      totalPages: 0,
      page: 1,
      pagingCounter: 1,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: null,
      prevPage: null,
    } as PaginatedResponse<T>);
  },

  create: <T = Record<string, unknown>>(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
    authorId?: string; // Payload CMS user ID
    clientMutationId?: string; // For idempotency
  }) => {
    // Use Payload custom endpoint: POST /api/posts/:id/comments
    // Backend expects: content, parentCommentId (optional), clientMutationId (optional)
    const payload = {
      content: data.text,
      parentCommentId: data.parent,
      clientMutationId: data.clientMutationId,
    };
    console.log(
      "[API] comments.create to /api/posts/" + data.post + "/comments:",
      JSON.stringify(payload),
    );
    return apiFetch<T>(`/api/posts/${data.post}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

/**
 * Tickets API
 */
export const tickets = {
  create: <T = Record<string, unknown>>(data: {
    eventId: string;
    paid?: boolean;
    status?: "valid" | "checked_in" | "revoked";
  }) =>
    apiFetch<T>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkIn: <T = Record<string, unknown>>(data: { qrToken: string }) =>
    apiFetch<T>("/api/tickets/check-in", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEventTickets: <T = Record<string, unknown>>(eventId: string) =>
    apiFetch<{ tickets: T[]; total: number }>(`/api/events/${eventId}/tickets`),
};

/**
 * Event Reviews API
 */
export const eventReviews = {
  create: <T = Record<string, unknown>>(data: {
    eventId: string;
    rating: number;
    comment?: string;
  }) =>
    apiFetch<T>("/api/event-reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEventReviews: <T = Record<string, unknown>>(
    eventId: string,
    params: { limit?: number; page?: number } = {},
  ) => {
    const queryString = buildQueryString(params);
    return apiFetch<PaginatedResponse<T>>(
      `/api/event-reviews?eventId=${eventId}${queryString}`,
    );
  },
};

/**
 * Blocks API - User blocking functionality
 */
export const blocks = {
  // Get all users blocked by the current user
  getBlocked: <T = Record<string, unknown>>(params: FindParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.page) searchParams.set("page", String(params.page));
    searchParams.set("depth", "2");
    searchParams.set("sort", "-createdAt");
    const queryString = searchParams.toString();
    return apiFetch<PaginatedResponse<T>>(
      `/api/blocks/me${queryString ? `?${queryString}` : ""}`,
    );
  },

  // Block a user
  block: <T = Record<string, unknown>>(userId: string, reason?: string) =>
    apiFetch<T>("/api/blocks", {
      method: "POST",
      body: JSON.stringify({ blocked: userId, reason }),
    }),

  // Unblock a user
  unblock: (blockId: string) =>
    apiFetch<{ success: boolean }>(`/api/blocks/${blockId}`, {
      method: "DELETE",
    }),

  // Check if a user is blocked
  isBlocked: (userId: string) =>
    apiFetch<{ blocked: boolean; blockId?: string }>(
      `/api/blocks/check/${userId}`,
    ),
};

/**
 * User Settings/Preferences API
 */
export const userSettings = {
  // Get notification preferences
  getNotificationPrefs: <T = Record<string, unknown>>() =>
    apiFetch<T>("/api/users/me/notification-prefs"),

  // Update notification preferences
  updateNotificationPrefs: <T = Record<string, unknown>>(prefs: {
    pauseAll?: boolean;
    likes?: boolean;
    comments?: boolean;
    follows?: boolean;
    mentions?: boolean;
    messages?: boolean;
    liveVideos?: boolean;
    emailNotifications?: boolean;
  }) =>
    apiFetch<T>("/api/users/me/notification-prefs", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }),

  // Get privacy settings
  getPrivacySettings: <T = Record<string, unknown>>() =>
    apiFetch<T>("/api/users/me/privacy"),

  // Update privacy settings
  updatePrivacySettings: <T = Record<string, unknown>>(settings: {
    privateAccount?: boolean;
    activityStatus?: boolean;
    readReceipts?: boolean;
    showLikes?: boolean;
  }) =>
    apiFetch<T>("/api/users/me/privacy", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
};

/**
 * Event Comments API
 */
export const eventComments = {
  create: <T = Record<string, unknown>>(data: {
    eventId: string;
    text: string;
    parent?: string;
    authorUsername?: string;
  }) =>
    apiFetch<T>("/api/event-comments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEventComments: <T = Record<string, unknown>>(
    eventId: string,
    params: { limit?: number; page?: number } = {},
  ) => {
    // Build query params properly to avoid double ? in URL
    const searchParams = new URLSearchParams();
    searchParams.set("where[event][equals]", eventId);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.page) searchParams.set("page", String(params.page));
    searchParams.set("depth", "1");
    searchParams.set("sort", "-createdAt");
    return apiFetch<PaginatedResponse<T>>(
      `/api/event-comments?${searchParams.toString()}`,
    );
  },
};

// ============================================================
// PHASE 0: NETWORK DIAGNOSTIC FUNCTION
// Run this at startup or on demand to verify API connectivity
// ============================================================
export interface DiagnosticResult {
  endpoint: string;
  method: string;
  status: number | "NETWORK_ERROR";
  ok: boolean;
  responsePreview: string;
  error?: string;
}

export async function runNetworkDiagnostic(): Promise<{
  apiBase: string;
  results: DiagnosticResult[];
  allPassed: boolean;
}> {
  console.log("[DIAGNOSTIC] ========================================");
  console.log("[DIAGNOSTIC] RUNNING NETWORK DIAGNOSTIC");
  console.log("[DIAGNOSTIC] API_BASE:", PAYLOAD_URL);
  console.log("[DIAGNOSTIC] ========================================");

  const results: DiagnosticResult[] = [];

  // Test 1: GET /api/users/me (auth check)
  try {
    const authToken = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `JWT ${authToken}`;
    }

    const meUrl = joinUrl(PAYLOAD_URL, "/api/users/me");
    const meRes = await fetch(meUrl, { headers, credentials: "omit" });
    const meData = await meRes.text();
    results.push({
      endpoint: "/api/users/me",
      method: "GET",
      status: meRes.status,
      ok: meRes.ok,
      responsePreview: meData.slice(0, 200),
    });
    console.log(`[DIAGNOSTIC] /api/users/me => ${meRes.status}`);
  } catch (e: any) {
    results.push({
      endpoint: "/api/users/me",
      method: "GET",
      status: "NETWORK_ERROR",
      ok: false,
      responsePreview: "",
      error: e.message,
    });
    console.error(`[DIAGNOSTIC] /api/users/me => NETWORK_ERROR: ${e.message}`);
  }

  // Test 2: GET /api/posts (feed check - no auth required for public posts)
  try {
    const postsUrl = joinUrl(PAYLOAD_URL, "/api/posts?limit=1");
    const postsRes = await fetch(postsUrl, { credentials: "omit" });
    const postsData = await postsRes.text();
    results.push({
      endpoint: "/api/posts",
      method: "GET",
      status: postsRes.status,
      ok: postsRes.ok,
      responsePreview: postsData.slice(0, 200),
    });
    console.log(`[DIAGNOSTIC] /api/posts => ${postsRes.status}`);
  } catch (e: any) {
    results.push({
      endpoint: "/api/posts",
      method: "GET",
      status: "NETWORK_ERROR",
      ok: false,
      responsePreview: "",
      error: e.message,
    });
    console.error(`[DIAGNOSTIC] /api/posts => NETWORK_ERROR: ${e.message}`);
  }

  // Test 3: GET /api/users (users list - basic connectivity)
  try {
    const usersUrl = joinUrl(PAYLOAD_URL, "/api/users?limit=1");
    const usersRes = await fetch(usersUrl, { credentials: "omit" });
    const usersData = await usersRes.text();
    results.push({
      endpoint: "/api/users",
      method: "GET",
      status: usersRes.status,
      ok: usersRes.ok,
      responsePreview: usersData.slice(0, 200),
    });
    console.log(`[DIAGNOSTIC] /api/users => ${usersRes.status}`);
  } catch (e: any) {
    results.push({
      endpoint: "/api/users",
      method: "GET",
      status: "NETWORK_ERROR",
      ok: false,
      responsePreview: "",
      error: e.message,
    });
    console.error(`[DIAGNOSTIC] /api/users => NETWORK_ERROR: ${e.message}`);
  }

  const allPassed = results.every((r) => r.ok || r.status === 401);
  // 401 is acceptable for /api/users/me when not logged in

  console.log("[DIAGNOSTIC] ========================================");
  console.log("[DIAGNOSTIC] RESULTS:");
  results.forEach((r) => {
    const symbol = r.ok ? "✓" : r.status === 401 ? "⚠" : "✗";
    console.log(
      `[DIAGNOSTIC] ${symbol} ${r.method} ${r.endpoint} => ${r.status}`,
    );
  });
  console.log(`[DIAGNOSTIC] ALL PASSED: ${allPassed}`);
  console.log("[DIAGNOSTIC] ========================================");

  return {
    apiBase: PAYLOAD_URL,
    results,
    allPassed,
  };
}

// Export API base for external use
export const API_BASE = PAYLOAD_URL;
