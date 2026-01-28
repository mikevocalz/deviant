/**
 * TanStack Query Debug Utilities (DEV only)
 *
 * PHASE 0: Query instrumentation and runtime asserts
 *
 * Features:
 * 1. Log all queries/mutations with keys, URLs, status
 * 2. Log setQueryData/invalidateQueries calls
 * 3. Runtime asserts for forbidden keys
 * 4. Object.freeze on query results to catch mutations
 */

import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

// ============================================================
// FORBIDDEN KEYS - These are too broad and cause regressions
// ============================================================
const FORBIDDEN_KEYS = [
  "user", // Must be ['user', userId]
  "profile", // Must be ['profile', userId]
  "me", // Use ['authUser'] instead
  "posts", // Must be scoped: ['posts', 'feed'] or ['posts', 'profile', userId]
  "users", // Must be scoped by userId
];

// Keys that MUST have an ID parameter
const KEYS_REQUIRING_ID = {
  profile: "userId",
  user: "userId",
  followers: "userId",
  following: "userId",
  followState: "viewerId, targetUserId",
  likeState: "viewerId, postId",
  bookmarkState: "viewerId, postId",
  bookmarks: "viewerId",
  post: "postId",
  postComments: "postId",
  messages: "viewerId, conversationId",
  conversations: "viewerId",
  blockedUsers: "viewerId",
  notificationPrefs: "viewerId",
  privacySettings: "viewerId",
};

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

export function validateQueryKey(queryKey: readonly unknown[]): void {
  if (!__DEV__) return;

  const keyStr = JSON.stringify(queryKey);
  const firstKey = queryKey[0];

  // Check for forbidden single-element keys
  if (queryKey.length === 1 && typeof firstKey === "string") {
    if (FORBIDDEN_KEYS.includes(firstKey)) {
      console.error(
        `[QueryDebug] ❌ FORBIDDEN KEY: ${keyStr}\n` +
          `  Key "${firstKey}" is too broad and causes cache collisions.\n` +
          `  Use scoped key like ['${firstKey}', id] instead.`,
      );
      // Don't throw in production, just log loudly
    }
  }

  // Check for keys missing required IDs
  if (typeof firstKey === "string" && firstKey in KEYS_REQUIRING_ID) {
    const requiredParams =
      KEYS_REQUIRING_ID[firstKey as keyof typeof KEYS_REQUIRING_ID];
    if (queryKey.length < 2 || !queryKey[1]) {
      console.error(
        `[QueryDebug] ❌ MISSING ID: ${keyStr}\n` +
          `  Key "${firstKey}" requires: ${requiredParams}\n` +
          `  Got key with length ${queryKey.length}`,
      );
    }
  }
}

export function freezeQueryResult<T>(data: T): T {
  if (!__DEV__) return data;
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  try {
    // Shallow freeze - catches most accidental mutations
    return Object.freeze(data) as T;
  } catch {
    // Some objects can't be frozen
    return data;
  }
}

// ============================================================
// DEBUG LOGGING
// ============================================================

let queryDebugEnabled = __DEV__;

export function setQueryDebugEnabled(enabled: boolean): void {
  queryDebugEnabled = enabled;
}

function logQuery(
  type: "fetch" | "success" | "error",
  queryKey: readonly unknown[],
  extra?: Record<string, unknown>,
): void {
  if (!queryDebugEnabled) return;

  const keyStr = JSON.stringify(queryKey);
  const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "🔄";

  console.log(`[Query] ${emoji} ${type.toUpperCase()}: ${keyStr}`, extra || "");
}

function logMutation(
  type: "start" | "success" | "error",
  mutationKey: readonly unknown[] | undefined,
  extra?: Record<string, unknown>,
): void {
  if (!queryDebugEnabled) return;

  const keyStr = mutationKey ? JSON.stringify(mutationKey) : "(no key)";
  const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "🔄";

  console.log(
    `[Mutation] ${emoji} ${type.toUpperCase()}: ${keyStr}`,
    extra || "",
  );
}

function logCacheUpdate(
  type: "setQueryData" | "invalidateQueries",
  queryKey: readonly unknown[],
  extra?: Record<string, unknown>,
): void {
  if (!queryDebugEnabled) return;

  const keyStr = JSON.stringify(queryKey);
  const emoji = type === "setQueryData" ? "📝" : "🗑️";

  console.log(`[Cache] ${emoji} ${type}: ${keyStr}`, extra || "");
}

// ============================================================
// QUERY CLIENT FACTORY WITH INSTRUMENTATION
// ============================================================

export function createInstrumentedQueryClient(): QueryClient {
  const queryCache = new QueryCache({
    onSuccess: (data, query) => {
      validateQueryKey(query.queryKey);
      logQuery("success", query.queryKey, {
        dataType: Array.isArray(data) ? `array[${data.length}]` : typeof data,
      });
    },
    onError: (error, query) => {
      logQuery("error", query.queryKey, {
        error: (error as Error).message,
      });
    },
  });

  const mutationCache = new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      logMutation("success", mutation.options.mutationKey, {
        dataType: typeof data,
      });
    },
    onError: (error, variables, context, mutation) => {
      logMutation("error", mutation.options.mutationKey, {
        error: (error as Error).message,
      });
    },
    onMutate: (variables, mutation) => {
      logMutation("start", mutation.options.mutationKey, {
        variables: typeof variables,
      });
    },
  });

  const queryClient = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 5, // 5 minutes
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });

  // Wrap setQueryData to add logging
  const originalSetQueryData = queryClient.setQueryData.bind(queryClient);
  (queryClient as any).setQueryData = function <T>(
    queryKey: readonly unknown[],
    updater: T | ((old: T | undefined) => T | undefined),
  ): T | undefined {
    validateQueryKey(queryKey);
    logCacheUpdate("setQueryData", queryKey);
    return originalSetQueryData(queryKey, updater) as T | undefined;
  };

  // Wrap invalidateQueries to add logging
  const originalInvalidateQueries =
    queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = function (filters?: any, options?: any) {
    if (filters?.queryKey) {
      logCacheUpdate("invalidateQueries", filters.queryKey);
    } else if (__DEV__) {
      console.warn(
        "[QueryDebug] ⚠️ invalidateQueries called without specific queryKey.\n" +
          "  This may cause unnecessary refetches. Consider using targeted invalidation.",
      );
    }
    return originalInvalidateQueries(filters, options);
  };

  return queryClient;
}

// ============================================================
// CANONICAL KEY DEFINITIONS
// ============================================================

/**
 * Canonical query key factories
 *
 * RULE: All keys must be scoped by required IDs
 */
export const canonicalKeys = {
  // Auth
  authUser: () => ["authUser"] as const,

  // Profiles
  profile: (userId: string) => ["profile", userId] as const,
  profilePosts: (userId: string) => ["profilePosts", userId] as const,

  // Users (generic lookup)
  user: (userId: string) => ["user", userId] as const,
  userByUsername: (username: string) => ["user", "username", username] as const,

  // Social
  followers: (userId: string) => ["followers", userId] as const,
  following: (userId: string) => ["following", userId] as const,
  followState: (viewerId: string, targetUserId: string) =>
    ["followState", viewerId, targetUserId] as const,

  // Posts
  feed: () => ["feed"] as const,
  feedInfinite: () => ["feed", "infinite"] as const,
  post: (postId: string) => ["post", postId] as const,
  postComments: (postId: string) => ["postComments", postId] as const,
  commentReplies: (commentId: string) => ["commentReplies", commentId] as const,

  // Likes
  likeState: (viewerId: string, postId: string) =>
    ["likeState", viewerId, postId] as const,
  postLikes: (postId: string) => ["postLikes", postId] as const,

  // Bookmarks
  bookmarkState: (viewerId: string, postId: string) =>
    ["bookmarkState", viewerId, postId] as const,
  bookmarks: (viewerId: string) => ["bookmarks", viewerId] as const,

  // Stories
  stories: () => ["stories"] as const,
  story: (storyId: string) => ["story", storyId] as const,

  // Messaging
  conversations: (viewerId: string, box: "inbox" | "spam") =>
    ["conversations", viewerId, box] as const,
  messages: (viewerId: string, conversationId: string) =>
    ["messages", viewerId, conversationId] as const,
  badges: (viewerId: string) => ["badges", viewerId] as const,
  unreadCount: () => ["unreadCount"] as const,

  // Notifications
  notifications: (viewerId: string) => ["notifications", viewerId] as const,

  // Settings
  blockedUsers: (viewerId: string) => ["blockedUsers", viewerId] as const,
  notificationPrefs: (viewerId: string) =>
    ["notificationPrefs", viewerId] as const,
  privacySettings: (viewerId: string) => ["privacySettings", viewerId] as const,

  // Events
  events: () => ["events"] as const,
  event: (eventId: string) => ["events", "detail", eventId] as const,
  eventComments: (eventId: string) => ["eventComments", eventId] as const,
  eventReviews: (eventId: string) => ["eventReviews", eventId] as const,

  // Search
  searchPosts: (query: string) => ["search", "posts", query] as const,
  searchUsers: (query: string) => ["search", "users", query] as const,

  // Liked posts (for current user)
  likedPosts: () => ["likedPosts"] as const,
};

// Export type for canonical keys
export type CanonicalKeys = typeof canonicalKeys;
