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

// API base URL - Uses the deployed API server for all API calls
// Note: Expo Router API routes work for web dev, but native apps need a real server
// Priority: EXPO_PUBLIC_API_URL > EXPO_PUBLIC_AUTH_URL (Hono server has API endpoints)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_AUTH_URL || "";

// Log the API URL for debugging
console.log("[API] Using base URL:", API_BASE_URL || "(relative - web only)");
console.log("[API] EXPO_PUBLIC_API_URL:", process.env.EXPO_PUBLIC_API_URL || "(not set)");
console.log("[API] EXPO_PUBLIC_AUTH_URL:", process.env.EXPO_PUBLIC_AUTH_URL || "(not set)");

if (Platform.OS !== "web" && !API_BASE_URL) {
  console.warn("[API] Warning: No API_URL set for native. API calls will fail.");
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

// Build query string from params
function buildQueryString(params: FindParams): string {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined)
    searchParams.set("limit", String(params.limit));
  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.depth !== undefined)
    searchParams.set("depth", String(params.depth));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.where) searchParams.set("where", JSON.stringify(params.where));

  const queryString = searchParams.toString();
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
    console.error(`[API] Error ${response.status}:`, JSON.stringify(data, null, 2));
    
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
  }): Promise<{ user: T }> => {
    // First get current user to find their ID
    const { user: currentUser } = await users.me<{ id: string }>();
    if (!currentUser?.id) {
      throw new Error("Not authenticated");
    }
    
    // Use Payload CMS standard endpoint: PATCH /api/users/{id}
    const updatedUser = await apiFetch<T>(`/api/users/${currentUser.id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    
    return { user: updatedUser };
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

  follow: async (userId: string, action: "follow" | "unfollow") => {
    return apiFetch<{
      message: string;
      following: boolean;
      followersCount: number;
    }>("/api/users/follow", {
      method: "POST",
      body: JSON.stringify({ userId, action }),
    });
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
 * Stories API
 */
export const stories = {
  find: <T = Record<string, unknown>>(params: FindParams = {}) =>
    apiFetch<PaginatedResponse<T>>(`/api/stories${buildQueryString(params)}`),

  create: <T = Record<string, unknown>>(data: Record<string, unknown>) =>
    apiFetch<T>("/api/stories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

/**
 * Notifications API
 */
export const notifications = {
  find: <T = Record<string, unknown>>(params: FindParams = {}) =>
    apiFetch<PaginatedResponse<T>>(
      `/api/notifications${buildQueryString(params)}`,
    ),

  create: <T = Record<string, unknown>>(data: {
    type: "like" | "comment" | "follow" | "mention";
    recipientUsername: string;
    senderUsername?: string;
    postId?: string;
    content?: string;
  }) =>
    apiFetch<T>("/api/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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

  create: <T = Record<string, unknown>>(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
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
