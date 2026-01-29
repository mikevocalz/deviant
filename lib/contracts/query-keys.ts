/**
 * CANONICAL QUERY KEY REGISTRY
 * 
 * This is the SINGLE SOURCE OF TRUTH for all TanStack Query keys.
 * 
 * RULES:
 * 1. NO ad-hoc query key arrays in components
 * 2. ALL query keys MUST be created via these factories
 * 3. User-specific data MUST include viewerId or userId in the key
 * 4. Generic keys like ['user'] or ['profile'] are FORBIDDEN
 * 
 * @see PREVENTION.md for guardrail documentation
 */

// =============================================================================
// AUTH KEYS
// =============================================================================

export const authKeys = {
  /** Current authenticated user - global singleton */
  user: () => ["authUser"] as const,
} as const;

// =============================================================================
// PROFILE KEYS
// =============================================================================

export const profileKeys = {
  /** Base key - NEVER use directly for queries */
  _base: ["profile"] as const,
  
  /** Profile by user ID - REQUIRED for all profile queries */
  byId: (userId: string) => ["profile", userId] as const,
  
  /** Profile by username */
  byUsername: (username: string) => ["profile", "username", username] as const,
  
  /** User's posts */
  posts: (userId: string) => ["profile", userId, "posts"] as const,
  
  /** User's followers list */
  followers: (userId: string) => ["profile", userId, "followers"] as const,
  
  /** User's following list */
  following: (userId: string) => ["profile", userId, "following"] as const,
} as const;

// =============================================================================
// POST KEYS
// =============================================================================

export const postKeys = {
  /** Base key - use for broad invalidation after create/delete only */
  all: ["posts"] as const,
  
  /** Feed posts (non-infinite) */
  feed: () => ["posts", "feed"] as const,
  
  /** Infinite feed posts */
  feedInfinite: () => ["posts", "feed", "infinite"] as const,
  
  /** Single post detail */
  detail: (postId: string) => ["posts", "detail", postId] as const,
  
  /** Posts by username (profile grid) */
  byUsername: (username: string) => ["posts", "profile", username] as const,
  
  /** Posts by multiple IDs */
  byIds: (ids: string[]) => ["posts", "byIds", ids.sort().join(",")] as const,
} as const;

// =============================================================================
// LIKE STATE KEYS
// =============================================================================

export const likeStateKeys = {
  /** 
   * Like state for a post - MUST include viewerId
   * This is the SINGLE SOURCE OF TRUTH for post likes
   */
  forPost: (viewerId: string, postId: string) =>
    ["likeState", viewerId, postId] as const,
  
  /** Like state for a comment - MUST include viewerId */
  forComment: (viewerId: string, commentId: string) =>
    ["likeState", "comment", viewerId, commentId] as const,
  
  /** User's liked posts list */
  likedPosts: (userId: string) => ["likedPosts", userId] as const,
} as const;

// =============================================================================
// BOOKMARK STATE KEYS
// =============================================================================

export const bookmarkKeys = {
  /** 
   * Bookmark state for a post - MUST include viewerId
   * This is the SINGLE SOURCE OF TRUTH for bookmarks
   */
  forPost: (viewerId: string, postId: string) =>
    ["bookmarkState", viewerId, postId] as const,
  
  /** User's bookmarked posts list */
  list: (viewerId: string) => ["bookmarks", "list", viewerId] as const,
} as const;

// =============================================================================
// FOLLOW STATE KEYS
// =============================================================================

export const followKeys = {
  /**
   * Follow state between two users - MUST include both IDs
   * This is the SINGLE SOURCE OF TRUTH for follow relationships
   */
  state: (viewerId: string, targetUserId: string) =>
    ["followState", viewerId, targetUserId] as const,
} as const;

// =============================================================================
// COMMENT KEYS
// =============================================================================

export const commentKeys = {
  /** Base key */
  all: ["comments"] as const,
  
  /** Comments for a specific post */
  byPost: (postId: string) => ["comments", "post", postId] as const,
  
  /** Replies to a specific comment */
  replies: (parentId: string) => ["comments", "replies", parentId] as const,
} as const;

// =============================================================================
// NOTIFICATION KEYS
// =============================================================================

export const notificationKeys = {
  /** 
   * User's notifications - MUST include viewerId
   * Different users see different notifications
   */
  list: (viewerId: string) => ["notifications", viewerId] as const,
  
  /** Unread badge count */
  badge: (viewerId: string) => ["notifications", "badge", viewerId] as const,
} as const;

// =============================================================================
// EVENT KEYS
// =============================================================================

export const eventKeys = {
  /** Base key */
  all: ["events"] as const,
  
  /** All events list */
  list: () => ["events", "list"] as const,
  
  /** Upcoming events */
  upcoming: () => ["events", "upcoming"] as const,
  
  /** Past events */
  past: () => ["events", "past"] as const,
  
  /** Single event detail */
  detail: (eventId: string) => ["events", "detail", eventId] as const,
  
  /** Events by category */
  byCategory: (category: string) => ["events", "category", category] as const,
  
  /** Event attendees */
  attendees: (eventId: string) => ["events", eventId, "attendees"] as const,
} as const;

// =============================================================================
// TICKET KEYS
// =============================================================================

export const ticketKeys = {
  /** User's tickets - MUST include userId */
  byUser: (userId: string) => ["tickets", "user", userId] as const,
  
  /** Ticket for specific event */
  forEvent: (userId: string, eventId: string) =>
    ["tickets", userId, eventId] as const,
} as const;

// =============================================================================
// STORY KEYS
// =============================================================================

export const storyKeys = {
  /** Base key */
  all: ["stories"] as const,
  
  /** Active stories feed */
  feed: () => ["stories", "feed"] as const,
  
  /** User's own story */
  mine: (userId: string) => ["stories", "mine", userId] as const,
  
  /** Single story detail */
  detail: (storyId: string) => ["stories", "detail", storyId] as const,
} as const;

// =============================================================================
// MESSAGE KEYS
// =============================================================================

export const messageKeys = {
  /** User's conversations - MUST include userId */
  conversations: (userId: string) => ["messages", "conversations", userId] as const,
  
  /** Messages in a conversation */
  thread: (conversationId: string) => ["messages", "thread", conversationId] as const,
} as const;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * BANNED QUERY KEY PATTERNS
 * These patterns are FORBIDDEN and should trigger errors in DEV.
 */
export const BANNED_KEY_PATTERNS = [
  ["user"],
  ["users"],
  ["profile"],    // Missing userId
  ["posts"],      // Use postKeys.all only for broad invalidation
  ["comments"],   // Missing postId
  ["bookmarks"],  // Missing viewerId
  ["notifications"], // Missing viewerId
  ["followers"],  // Missing userId
  ["following"],  // Missing userId
] as const;

/**
 * Check if a query key is forbidden.
 * Call this in DEV to catch bad query keys.
 */
export function isQueryKeyForbidden(key: readonly unknown[]): boolean {
  if (key.length === 1) {
    const firstElement = key[0];
    return BANNED_KEY_PATTERNS.some(
      (banned) => banned.length === 1 && banned[0] === firstElement
    );
  }
  return false;
}

/**
 * Assert that a query key is valid.
 * Throws in DEV if the key matches a banned pattern.
 */
export function assertValidQueryKey(key: readonly unknown[], context: string): void {
  if (__DEV__ && isQueryKeyForbidden(key)) {
    throw new Error(
      `[QUERY KEY] Forbidden key pattern detected in ${context}: ${JSON.stringify(key)}\n` +
      `Use scoped keys with IDs instead. See lib/contracts/query-keys.ts`
    );
  }
}
