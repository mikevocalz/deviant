/**
 * Client-side API utilities for Expo app
 *
 * These functions call the Expo Router API routes, NOT Payload CMS directly.
 * API keys are never exposed to the client.
 *
 * Architecture:
 * This Client → Expo API Route (+api.ts) → Payload CMS
 *
 * In production, set EXPO_PUBLIC_API_URL to your deployed API server URL.
 * In development, leave it empty to use relative URLs with the Expo dev server.
 */

import { getAuthCookies } from "@/lib/auth-client";
import { Platform } from "react-native";

// CRITICAL: Import canonical API URL resolver - single source of truth
import {
  getApiBaseUrl,
  getPayloadBaseUrl,
  validateApiConfig,
} from "@/lib/api-config";

// API base URL - Uses canonical resolver that NEVER returns empty/localhost
// This is the SINGLE SOURCE OF TRUTH for API URLs
const API_BASE_URL = getApiBaseUrl();

// Payload CMS URL - for social actions (follows, likes, bookmarks, etc.)
// CRITICAL: This must point to Payload CMS, NOT the auth server
const PAYLOAD_BASE_URL = getPayloadBaseUrl();

// Validate configuration at module load
validateApiConfig();

// Hard guard - fail fast if configuration is invalid
if (!API_BASE_URL || !API_BASE_URL.startsWith("https://")) {
  throw new Error(
    `[API] CRITICAL: Invalid API configuration. API_BASE_URL="${API_BASE_URL}" is not a valid HTTPS URL. Check environment variables.`,
  );
}

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

// Base fetch with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

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

  // Debug logging for API calls
  if (__DEV__ || options.method === "POST" || options.method === "PATCH") {
    console.log(`[API] ${options.method || "GET"} ${url}`);
    console.log("[API] Has auth token:", !!authToken);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: API_BASE_URL ? "omit" : "include", // omit for cross-origin, include for same-origin
  });

  let data: any;
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    data = await response.json();
  } else {
    // Handle non-JSON responses (HTML error pages, etc)
    const text = await response.text();
    console.error("[API] Non-JSON response:", text.slice(0, 200));
    data = { error: `Server returned non-JSON response (${response.status})` };
  }

  if (!response.ok) {
    console.error(
      `[API] Error ${response.status}:`,
      JSON.stringify(data, null, 2),
    );

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

// Payload CMS fetch - for social actions (follows, likes, bookmarks)
// CRITICAL: Uses PAYLOAD_BASE_URL which points to Payload CMS, not auth server
async function payloadFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${PAYLOAD_BASE_URL}${endpoint}`;

  // Get auth token for authenticated requests
  const authToken = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Use JWT token for authorization
  if (authToken) {
    headers["Authorization"] = `JWT ${authToken}`;
  }

  console.log(`[PayloadAPI] ${options.method || "GET"} ${url}`);
  console.log("[PayloadAPI] Has auth token:", !!authToken);

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "omit", // Always omit for cross-origin
  });

  let data: any;
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.error("[PayloadAPI] Non-JSON response:", text.slice(0, 200));
    data = { error: `Server returned non-JSON response (${response.status})` };
  }

  if (!response.ok) {
    console.error(
      `[PayloadAPI] Error ${response.status}:`,
      JSON.stringify(data, null, 2),
    );

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
    const res = await apiFetch<{ user: T }>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res;
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

  // STABILIZED: Fetches from dedicated likes collection via Payload CMS
  getLikedPosts: async (): Promise<string[]> => {
    try {
      const currentUser = await users.me<{ id: string }>();
      if (!currentUser.user?.id) return [];

      // Fetch from likes collection via Payload CMS
      const response = await payloadFetch<{
        docs: Array<{ post: string | { id: string } }>;
      }>(
        `/api/likes?where[user][equals]=${currentUser.user.id}&where[post][exists]=true&limit=1000`,
      );

      if (!response.docs) return [];

      return response.docs
        .map((like: any) => {
          const postId = like.post;
          if (typeof postId === "string") return postId;
          if (postId?.id) return postId.id;
          return null;
        })
        .filter(
          (id): id is string => !!id && id !== "undefined" && id !== "null",
        );
    } catch (error) {
      console.error("[users] getLikedPosts error:", error);
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
    media: { type: "image" | "video"; url: string; posterUrl?: string };
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
 * Comments API
 */
export const comments = {
  findByPost: <T = Record<string, unknown>>(
    postId: string,
    params: FindParams = {},
  ) => {
    const queryString = buildQueryString(params);
    const postIdParam = `${queryString ? "&" : "?"}postId=${postId}`;
    return apiFetch<PaginatedResponse<T>>(
      `/api/comments${queryString}${postIdParam}`,
    );
  },

  findByParent: <T = Record<string, unknown>>(
    parentId: string,
    params: FindParams = {},
  ) => {
    const queryString = buildQueryString(params);
    const parentIdParam = `${queryString ? "&" : "?"}parentId=${parentId}`;
    return apiFetch<PaginatedResponse<T>>(
      `/api/comments${queryString}${parentIdParam}`,
    );
  },

  create: <T = Record<string, unknown>>(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
    authorId?: string; // Payload CMS user ID
    clientMutationId?: string; // For idempotency
  }) =>
    apiFetch<T>("/api/comments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
    const queryString = buildQueryString(params);
    return apiFetch<PaginatedResponse<T>>(
      `/api/event-comments?eventId=${eventId}${queryString}`,
    );
  },
};
