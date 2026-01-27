/**
 * SINGLE SOURCE OF TRUTH FOR ALL API ENDPOINTS
 * 
 * ARCHITECTURE: Option A - Direct to Payload CMS
 * All paths are relative to PAYLOAD_URL (https://payload-cms-setup-gray.vercel.app)
 * All paths start with /api/
 * 
 * DO NOT use string literals for endpoints elsewhere in the codebase.
 * Import from this file instead.
 */

// ============================================================
// AUTH ENDPOINTS
// ============================================================
export const AUTH = {
  LOGIN: "/api/users/login",           // POST - Payload uses /users/login not /auth/login
  REGISTER: "/api/users",              // POST - Create user
  ME: "/api/users/me",                 // GET - Current user
  LOGOUT: "/api/users/logout",         // POST - Logout
} as const;

// ============================================================
// USER/PROFILE ENDPOINTS
// ============================================================
export const USERS = {
  ME: "/api/users/me",                           // GET/PATCH - Current user profile
  BY_ID: (id: string) => `/api/users/${id}`,     // GET - User by ID
  PROFILE: (id: string) => `/api/users/${id}/profile`,  // GET - Full profile
  POSTS: (id: string) => `/api/users/${id}/posts`,      // GET - User's posts
  AVATAR: "/api/users/me/avatar",                // POST - Upload avatar
  BY_USERNAME: (username: string) => `/api/users?where[username][equals]=${username}`,
} as const;

// ============================================================
// FOLLOW ENDPOINTS
// ============================================================
export const FOLLOW = {
  FOLLOW: "/api/users/follow",                          // POST - Follow user
  UNFOLLOW: "/api/users/follow",                        // DELETE - Unfollow user
  STATE: (id: string) => `/api/users/${id}/follow-state`, // GET - Check if following
  FOLLOWERS: (id: string) => `/api/users/${id}/followers`,
  FOLLOWING: (id: string) => `/api/users/${id}/following`,
} as const;

// ============================================================
// POST ENDPOINTS
// ============================================================
export const POSTS = {
  CREATE: "/api/posts",                          // POST - Create post
  FEED: "/api/posts/feed",                       // GET - Personalized feed
  LIST: "/api/posts",                            // GET - All posts (paginated)
  BY_ID: (id: string) => `/api/posts/${id}`,     // GET/PATCH - Single post
  DELETE: (id: string) => `/api/posts/${id}`,    // DELETE - Delete post
} as const;

// ============================================================
// LIKE ENDPOINTS
// ============================================================
export const LIKES = {
  LIKE: (postId: string) => `/api/posts/${postId}/like`,        // POST - Like
  UNLIKE: (postId: string) => `/api/posts/${postId}/like`,      // DELETE - Unlike
  STATE: (postId: string) => `/api/posts/${postId}/like-state`, // GET - Check if liked
} as const;

// ============================================================
// BOOKMARK ENDPOINTS
// ============================================================
export const BOOKMARKS = {
  BOOKMARK: (postId: string) => `/api/posts/${postId}/bookmark`,     // POST - Bookmark
  UNBOOKMARK: (postId: string) => `/api/posts/${postId}/bookmark`,   // DELETE - Unbookmark
  STATE: (postId: string) => `/api/posts/${postId}/bookmark-state`,  // GET - Check state
  MY_BOOKMARKS: "/api/users/me/bookmarks",                           // GET - My bookmarks
} as const;

// ============================================================
// COMMENT ENDPOINTS
// ============================================================
export const COMMENTS = {
  LIST: (postId: string) => `/api/posts/${postId}/comments`,    // GET - Post comments
  CREATE: (postId: string) => `/api/posts/${postId}/comments`,  // POST - Create comment
  LIKE: (commentId: string) => `/api/comments/${commentId}/like`, // POST - Like comment
} as const;

// ============================================================
// STORY ENDPOINTS
// ============================================================
export const STORIES = {
  CREATE: "/api/stories",                              // POST - Create story
  LIST: "/api/stories",                                // GET - All stories
  FEED: "/api/stories/feed",                           // GET - Stories feed
  BY_ID: (id: string) => `/api/stories/${id}`,         // GET - Single story
  VIEW: (id: string) => `/api/stories/${id}/view`,     // POST - Mark as viewed
  REPLY: (id: string) => `/api/stories/${id}/reply`,   // POST - Reply to story
} as const;

// ============================================================
// MESSAGING ENDPOINTS
// ============================================================
export const CONVERSATIONS = {
  DIRECT: "/api/conversations/direct",                           // POST - Start DM
  GROUP: "/api/conversations/group",                             // POST - Create group
  LIST: "/api/conversations",                                    // GET - List conversations
  BY_ID: (id: string) => `/api/conversations/${id}`,             // GET - Single conversation
  MESSAGES: (id: string) => `/api/conversations/${id}/messages`, // GET/POST - Messages
  READ: (id: string) => `/api/conversations/${id}/read`,         // POST - Mark as read
} as const;

// ============================================================
// NOTIFICATION ENDPOINTS
// ============================================================
export const NOTIFICATIONS = {
  LIST: "/api/notifications",                              // GET - All notifications
  READ: (id: string) => `/api/notifications/${id}/read`,   // POST - Mark as read
  READ_ALL: "/api/notifications/read-all",                 // POST - Mark all as read
} as const;

// ============================================================
// DEVICE/PUSH ENDPOINTS
// ============================================================
export const DEVICES = {
  REGISTER: "/api/devices/register",  // POST - Register push token
} as const;

// ============================================================
// BADGES ENDPOINTS
// ============================================================
export const BADGES = {
  LIST: "/api/badges",  // GET - User badges/counts
} as const;

// ============================================================
// ALL ENDPOINTS (for validation)
// ============================================================
export const ALL_ENDPOINTS = {
  AUTH,
  USERS,
  FOLLOW,
  POSTS,
  LIKES,
  BOOKMARKS,
  COMMENTS,
  STORIES,
  CONVERSATIONS,
  NOTIFICATIONS,
  DEVICES,
  BADGES,
} as const;

// ============================================================
// ENDPOINT VALIDATION HELPER
// ============================================================
export function validateEndpoint(path: string): boolean {
  // Must start with /api/
  if (!path.startsWith("/api/")) {
    console.error(`[Endpoints] Invalid path: ${path} - must start with /api/`);
    return false;
  }
  // Must not have double slashes
  if (path.includes("//")) {
    console.error(`[Endpoints] Invalid path: ${path} - contains //`);
    return false;
  }
  // Must not have /api/api
  if (path.includes("/api/api")) {
    console.error(`[Endpoints] Invalid path: ${path} - contains /api/api`);
    return false;
  }
  return true;
}
