/**
 * Privileged API Layer
 *
 * This module provides typed wrappers for all privileged database operations.
 * All writes to sensitive tables (users, posts, stories, events, messages, etc.)
 * MUST go through these wrappers.
 *
 * Each wrapper:
 * 1. Gets the Better Auth token
 * 2. Calls the appropriate Edge Function
 * 3. Returns typed response data
 *
 * NEVER call supabase.from("sensitive_table").insert/update/delete directly!
 * Use these wrappers instead.
 */

import { supabase } from "../../supabase/client";
import {
  requireBetterAuthToken,
  updateUserRowCache,
  clearUserRowCache,
} from "../../auth/identity";
import type { AppUser } from "../../auth-client";

// ============================================================================
// Types
// ============================================================================

interface PrivilegedResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// Profile types
export interface UpdateProfileInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  links?: string[];
  avatarUrl?: string;
}

// Post types
export interface CreatePostInput {
  content: string;
  mediaUrls?: string[];
  location?: string;
  visibility?: "public" | "followers" | "private";
  isNsfw?: boolean;
}

export interface UpdatePostInput {
  content?: string;
  location?: string;
  visibility?: "public" | "followers" | "private";
  isNsfw?: boolean;
}

// Story types
export interface CreateStoryInput {
  mediaUrl: string;
  mediaType: "image" | "video";
  duration?: number; // seconds for video
}

// Event types
export interface CreateEventInput {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  maxAttendees?: number;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  maxAttendees?: number;
}

export interface RsvpEventInput {
  eventId: number;
  status: "going" | "interested" | "not_going";
}

// Message types
export interface SendMessageInput {
  conversationId: number;
  body: string;
  mediaUrl?: string;
}

// Group types
export interface CreateGroupInput {
  name: string;
  description?: string;
  memberIds: number[];
}

export interface AddMemberInput {
  conversationId: number;
  userId: number;
}

export interface RemoveMemberInput {
  conversationId: number;
  userId: number;
}

export interface ChangeRoleInput {
  conversationId: number;
  userId: number;
  role: "admin" | "moderator" | "member";
}

// ============================================================================
// Helper
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function invokeEdgeFunction<T>(
  functionName: string,
  body: any,
): Promise<T> {
  const token = await requireBetterAuthToken();

  const { data, error } = await supabase.functions.invoke<
    PrivilegedResponse<T>
  >(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    console.error(`[Privileged] ${functionName} error:`, error);
    throw new Error(error.message || `Failed to call ${functionName}`);
  }

  if (!data?.ok) {
    const errorMessage = data?.error?.message || `${functionName} failed`;
    console.error(`[Privileged] ${functionName} failed:`, errorMessage);
    throw new Error(errorMessage);
  }

  return data.data as T;
}

// ============================================================================
// Auth Sync
// ============================================================================

/**
 * Sync the current Better Auth user to the Supabase users table.
 * Call this after login to ensure we have a valid user row.
 */
export async function syncAuthUser(): Promise<AppUser> {
  console.log("[Privileged] syncAuthUser");
  const result = await invokeEdgeFunction<{ user: AppUser; action: string }>(
    "auth-sync",
    {},
  );
  console.log("[Privileged] syncAuthUser result:", result.action);
  return result.user;
}

// ============================================================================
// Profile
// ============================================================================

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  input: UpdateProfileInput,
): Promise<AppUser> {
  console.log("[Privileged] updateProfile:", input);
  const result = await invokeEdgeFunction<{ user: AppUser }>(
    "update-profile",
    input,
  );

  // Update cache
  updateUserRowCache({
    firstName: input.firstName || input.name || undefined,
    lastName: input.lastName || undefined,
    bio: input.bio || undefined,
    location: input.location || undefined,
  });

  return result.user;
}

// ============================================================================
// Posts
// ============================================================================

/**
 * Create a new post.
 */
export async function createPost(
  input: CreatePostInput,
): Promise<{ post: any }> {
  console.log("[Privileged] createPost");
  return invokeEdgeFunction<{ post: any }>("create-post", input);
}

/**
 * Update an existing post.
 */
export async function updatePost(
  postId: number,
  input: UpdatePostInput,
): Promise<{ post: any }> {
  console.log("[Privileged] updatePost:", postId);
  return invokeEdgeFunction<{ post: any }>("update-post", { postId, ...input });
}

/**
 * Delete a post (soft delete).
 */
export async function deletePost(
  postId: number,
): Promise<{ success: boolean }> {
  console.log("[Privileged] deletePost:", postId);
  return invokeEdgeFunction<{ success: boolean }>("delete-post", { postId });
}

/**
 * Like or unlike a post.
 */
export async function togglePostLike(
  postId: number,
): Promise<{ liked: boolean; likesCount: number }> {
  console.log("[Privileged] togglePostLike:", postId);
  return invokeEdgeFunction<{ liked: boolean; likesCount: number }>(
    "toggle-post-like",
    { postId },
  );
}

// ============================================================================
// Stories
// ============================================================================

/**
 * Create a new story.
 */
export async function createStory(
  input: CreateStoryInput,
): Promise<{ story: any }> {
  console.log("[Privileged] createStory");
  return invokeEdgeFunction<{ story: any }>("create-story", input);
}

/**
 * Delete a story.
 */
export async function deleteStory(
  storyId: number,
): Promise<{ success: boolean }> {
  console.log("[Privileged] deleteStory:", storyId);
  return invokeEdgeFunction<{ success: boolean }>("delete-story", { storyId });
}

// ============================================================================
// Events
// ============================================================================

/**
 * Create a new event.
 */
export async function createEvent(
  input: CreateEventInput,
): Promise<{ event: any }> {
  console.log("[Privileged] createEvent");
  return invokeEdgeFunction<{ event: any }>("create-event", input);
}

/**
 * Update an existing event.
 */
export async function updateEvent(
  eventId: number,
  input: UpdateEventInput,
): Promise<{ event: any }> {
  console.log("[Privileged] updateEvent:", eventId);
  return invokeEdgeFunction<{ event: any }>("update-event", {
    eventId,
    ...input,
  });
}

/**
 * Delete an event.
 */
export async function deleteEvent(
  eventId: number,
): Promise<{ success: boolean }> {
  console.log("[Privileged] deleteEvent:", eventId);
  return invokeEdgeFunction<{ success: boolean }>("delete-event", { eventId });
}

/**
 * RSVP to an event.
 */
export async function rsvpEvent(input: RsvpEventInput): Promise<{ rsvp: any }> {
  console.log("[Privileged] rsvpEvent:", input.eventId, input.status);
  return invokeEdgeFunction<{ rsvp: any }>("rsvp-event", input);
}

// ============================================================================
// Messaging
// ============================================================================

/**
 * Send a message in a conversation.
 */
export async function sendMessage(
  input: SendMessageInput,
): Promise<{ message: any }> {
  console.log(
    "[Privileged] sendMessage to conversation:",
    input.conversationId,
  );
  return invokeEdgeFunction<{ message: any }>("send-message", input);
}

/**
 * Delete a message (soft delete).
 */
export async function deleteMessage(
  messageId: number,
): Promise<{ success: boolean }> {
  console.log("[Privileged] deleteMessage:", messageId);
  return invokeEdgeFunction<{ success: boolean }>("delete-message", {
    messageId,
  });
}

/**
 * Get unread message counts.
 */
export async function getUnreadCounts(): Promise<{
  inbox: number;
  spam: number;
}> {
  console.log("[Privileged] getUnreadCounts");
  return invokeEdgeFunction<{ inbox: number; spam: number }>(
    "unread-counts",
    {},
  );
}

// ============================================================================
// Groups
// ============================================================================

/**
 * Create a new group conversation.
 */
export async function createGroup(
  input: CreateGroupInput,
): Promise<{ conversation: any }> {
  console.log("[Privileged] createGroup:", input.name);
  return invokeEdgeFunction<{ conversation: any }>("create-group", input);
}

/**
 * Add a member to a group.
 */
export async function addMember(
  input: AddMemberInput,
): Promise<{ success: boolean }> {
  console.log(
    "[Privileged] addMember:",
    input.userId,
    "to",
    input.conversationId,
  );
  return invokeEdgeFunction<{ success: boolean }>("add-member", input);
}

/**
 * Remove a member from a group.
 */
export async function removeMember(
  input: RemoveMemberInput,
): Promise<{ success: boolean }> {
  console.log(
    "[Privileged] removeMember:",
    input.userId,
    "from",
    input.conversationId,
  );
  return invokeEdgeFunction<{ success: boolean }>("remove-member", input);
}

/**
 * Change a member's role in a group.
 */
export async function changeRole(
  input: ChangeRoleInput,
): Promise<{ success: boolean }> {
  console.log("[Privileged] changeRole:", input.userId, "to", input.role);
  return invokeEdgeFunction<{ success: boolean }>("change-role", input);
}

// ============================================================================
// Video
// ============================================================================

/**
 * Join a video room and get provider token.
 */
export async function videoJoin(conversationId: number): Promise<{
  token: string;
  roomId: string;
  provider: string;
}> {
  console.log("[Privileged] videoJoin:", conversationId);
  return invokeEdgeFunction<{
    token: string;
    roomId: string;
    provider: string;
  }>("video-join", { conversationId });
}

// ============================================================================
// Follows
// ============================================================================

/**
 * Follow or unfollow a user.
 */
export async function toggleFollow(
  targetUserId: number,
): Promise<{ following: boolean }> {
  console.log("[Privileged] toggleFollow:", targetUserId);
  return invokeEdgeFunction<{ following: boolean }>("toggle-follow", {
    targetUserId,
  });
}

// ============================================================================
// Comments
// ============================================================================

/**
 * Add a comment to a post.
 */
export async function addComment(
  postId: number,
  content: string,
): Promise<{ comment: any }> {
  console.log("[Privileged] addComment to post:", postId);
  return invokeEdgeFunction<{ comment: any }>("add-comment", {
    postId,
    content,
  });
}

/**
 * Delete a comment.
 */
export async function deleteComment(
  commentId: number,
): Promise<{ success: boolean }> {
  console.log("[Privileged] deleteComment:", commentId);
  return invokeEdgeFunction<{ success: boolean }>("delete-comment", {
    commentId,
  });
}

// ============================================================================
// Blocks
// ============================================================================

/**
 * Block or unblock a user.
 */
export async function toggleBlock(
  targetUserId: number,
): Promise<{ blocked: boolean }> {
  console.log("[Privileged] toggleBlock:", targetUserId);
  return invokeEdgeFunction<{ blocked: boolean }>("toggle-block", {
    targetUserId,
  });
}
