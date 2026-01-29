/**
 * DATA TRANSFER OBJECT (DTO) SCHEMAS
 * 
 * These Zod schemas define the EXACT shape of data from Payload CMS.
 * All API responses MUST be parsed through these schemas BEFORE:
 * - Touching UI components
 * - Entering TanStack Query cache
 * - Being used in optimistic updates
 * 
 * If the backend response shape changes, these schemas will FAIL LOUDLY
 * in development, preventing silent data corruption.
 * 
 * @see PREVENTION.md for guardrail documentation
 */

import { z } from "zod";

// =============================================================================
// PRIMITIVE SCHEMAS
// =============================================================================

/** Media object from Payload CMS (populated with depth >= 1) */
export const MediaDTO = z.object({
  id: z.union([z.string(), z.number()]),
  url: z.string().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

/** Avatar can be string URL, media object, or null */
export const AvatarDTO = z.union([
  z.string().url(),
  MediaDTO,
  z.null(),
  z.undefined(),
]);

// =============================================================================
// USER / PROFILE DTOs
// =============================================================================

/** Minimal user reference (author in posts/comments) */
export const UserRefDTO = z.object({
  id: z.union([z.string(), z.number()]),
  username: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  avatar: AvatarDTO.optional(),
  verified: z.boolean().optional(),
});

/** Full profile data */
export const ProfileDTO = z.object({
  id: z.union([z.string(), z.number()]),
  username: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  avatar: AvatarDTO.optional(),
  avatarUrl: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  followersCount: z.number().default(0),
  followingCount: z.number().default(0),
  postsCount: z.number().default(0),
  isFollowing: z.boolean().optional(),
  isFollowedBy: z.boolean().optional(),
  isOwnProfile: z.boolean().optional(),
});

/** Auth user (current logged-in user) */
export const AuthUserDTO = z.object({
  id: z.union([z.string(), z.number()]),
  username: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  avatar: AvatarDTO.optional(),
  verified: z.boolean().optional(),
});

// =============================================================================
// POST DTOs
// =============================================================================

/** Single media item in a post */
export const PostMediaDTO = z.object({
  url: z.string(),
  type: z.enum(["image", "video"]).default("image"),
  width: z.number().optional(),
  height: z.number().optional(),
  thumbnail: z.string().optional(),
});

/** Post data */
export const PostDTO = z.object({
  id: z.string(),
  content: z.string().optional(),
  author: UserRefDTO,
  media: z.array(PostMediaDTO).default([]),
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  sharesCount: z.number().default(0),
  createdAt: z.string(),
  timeAgo: z.string().optional(),
});

/** Like state for a post (viewer-specific) */
export const LikeStateDTO = z.object({
  hasLiked: z.boolean(),
  likesCount: z.number().min(0),
});

/** Bookmark state for a post (viewer-specific) */
export const BookmarkStateDTO = z.object({
  isBookmarked: z.boolean(),
});

// =============================================================================
// COMMENT DTOs
// =============================================================================

/** Comment data (supports threading) */
export const CommentDTO: z.ZodType<{
  id: string;
  text: string;
  author: z.infer<typeof UserRefDTO>;
  postId: string;
  parentId?: string | null;
  likesCount: number;
  hasLiked?: boolean;
  createdAt: string;
  timeAgo?: string;
  replies?: z.infer<typeof CommentDTO>[];
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    text: z.string(),
    author: UserRefDTO,
    postId: z.string(),
    parentId: z.string().nullable().optional(),
    likesCount: z.number().default(0),
    hasLiked: z.boolean().optional(),
    createdAt: z.string(),
    timeAgo: z.string().optional(),
    replies: z.array(CommentDTO).optional(),
  })
);

// =============================================================================
// FOLLOW DTOs
// =============================================================================

/** Follow state between two users */
export const FollowStateDTO = z.object({
  isFollowing: z.boolean(),
  isFollowedBy: z.boolean().optional(),
});

/** Follow action response */
export const FollowActionDTO = z.object({
  success: z.boolean(),
  following: z.boolean(),
  message: z.string().optional(),
});

// =============================================================================
// NOTIFICATION DTOs
// =============================================================================

export const NotificationTypeDTO = z.enum([
  "like",
  "comment",
  "follow",
  "mention",
  "event_invite",
  "event_update",
  "message",
]);

export const NotificationDTO = z.object({
  id: z.union([z.string(), z.number()]),
  type: NotificationTypeDTO,
  sender: UserRefDTO.optional(),
  recipient: z.union([z.string(), z.number()]),
  post: z.union([z.string(), z.number()]).optional(),
  comment: z.union([z.string(), z.number()]).optional(),
  event: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  read: z.boolean().default(false),
  createdAt: z.string(),
});

// =============================================================================
// EVENT DTOs
// =============================================================================

export const EventAttendeeDTO = z.object({
  id: z.string().optional(),
  name: z.string(),
  image: z.string().optional(),
  initials: z.string().optional(),
});

export const EventDTO = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  date: z.string(),
  month: z.string(),
  fullDate: z.date().optional(),
  time: z.string(),
  location: z.string(),
  price: z.number().default(0),
  image: z.string(),
  category: z.string(),
  attendees: z.array(EventAttendeeDTO).default([]),
  totalAttendees: z.number().default(0),
  likes: z.number().default(0),
});

// =============================================================================
// TICKET DTOs
// =============================================================================

export const TicketStatusDTO = z.enum(["valid", "checked_in", "revoked"]);

export const TicketDTO = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  paid: z.boolean(),
  status: TicketStatusDTO,
  checkedInAt: z.string().optional(),
  qrToken: z.string(),
  qrSvg: z.string().optional(),
  qrPngUrl: z.string().optional(),
  applePassUrl: z.string().optional(),
  googlePassUrl: z.string().optional(),
});

// =============================================================================
// STORY DTOs
// =============================================================================

export const StoryItemDTO = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(["image", "video"]).default("image"),
  duration: z.number().optional(),
  thumbnail: z.string().optional(),
});

export const StoryDTO = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  avatar: z.string(),
  items: z.array(StoryItemDTO).min(1),
  hasViewed: z.boolean().default(false),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
});

// =============================================================================
// PAGINATED RESPONSE
// =============================================================================

export const PaginatedResponseDTO = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    docs: z.array(itemSchema),
    totalDocs: z.number(),
    limit: z.number(),
    page: z.number().optional(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
    nextPage: z.number().nullable().optional(),
    prevPage: z.number().nullable().optional(),
  });

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Media = z.infer<typeof MediaDTO>;
export type UserRef = z.infer<typeof UserRefDTO>;
export type Profile = z.infer<typeof ProfileDTO>;
export type AuthUser = z.infer<typeof AuthUserDTO>;
export type Post = z.infer<typeof PostDTO>;
export type PostMedia = z.infer<typeof PostMediaDTO>;
export type LikeState = z.infer<typeof LikeStateDTO>;
export type BookmarkState = z.infer<typeof BookmarkStateDTO>;
export type Comment = z.infer<typeof CommentDTO>;
export type FollowState = z.infer<typeof FollowStateDTO>;
export type FollowAction = z.infer<typeof FollowActionDTO>;
export type NotificationType = z.infer<typeof NotificationTypeDTO>;
export type Notification = z.infer<typeof NotificationDTO>;
export type EventAttendee = z.infer<typeof EventAttendeeDTO>;
export type Event = z.infer<typeof EventDTO>;
export type TicketStatus = z.infer<typeof TicketStatusDTO>;
export type Ticket = z.infer<typeof TicketDTO>;
export type StoryItem = z.infer<typeof StoryItemDTO>;
export type Story = z.infer<typeof StoryDTO>;
