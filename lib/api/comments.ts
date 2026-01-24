/**
 * Comments API - fetches real comment data from Payload CMS
 */

import { comments as commentsApi, users, notifications, posts } from "@/lib/api-client";

// Cache for user ID lookups to avoid repeated API calls
const userIdCache: Record<string, string> = {};

// Extract @mentions from text
function extractMentions(text: string): string[] {
  if (!text) return [];
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]); // Get username without @
  }
  return [...new Set(mentions)]; // Remove duplicates
}

export interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  replies?: Comment[];
}

// Transform API response to match Comment type
function transformComment(doc: Record<string, unknown>): Comment {
  const author = doc.author as Record<string, unknown> | undefined;

  return {
    id: doc.id as string,
    username: (author?.username as string) || "user",
    avatar:
      (author?.avatar as string) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent((author?.name as string) || "User")}`,
    text: (doc.content as string) || (doc.text as string) || "", // CMS uses 'content', transform uses 'text'
    timeAgo: formatTimeAgo(doc.createdAt as string),
    likes: (doc.likes as number) || 0,
    replies: ((doc.replies as Array<Record<string, unknown>>) || []).map(
      transformComment,
    ),
  };
}

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export const commentsApiClient = {
  // Fetch comments for a post
  async getComments(postId: string): Promise<Comment[]> {
    try {
      const response = await commentsApi.findByPost(postId, { limit: 50 });
      return response.docs.map(transformComment);
    } catch (error) {
      console.error("[commentsApi] getComments error:", error);
      return [];
    }
  },

  // Create a new comment
  async createComment(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
  }): Promise<Comment> {
    try {
      // Clean and validate post ID
      const rawPostId = data.post;
      // Remove any spaces or invalid characters, convert to number if numeric
      const cleanedPostId = String(rawPostId).trim().replace(/\s+/g, '');
      const numericPostId = parseInt(cleanedPostId, 10);
      const postId = !isNaN(numericPostId) ? numericPostId : cleanedPostId;
      
      console.log("[commentsApi] createComment called with:", { 
        rawPost: rawPostId, 
        cleanedPost: postId,
        text: data.text?.slice(0, 50), 
        authorUsername: data.authorUsername 
      });
      
      // Validate post ID - should be a valid MongoDB ObjectID (24 hex chars) or numeric
      const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(cleanedPostId);
      const isNumericId = !isNaN(numericPostId);
      
      if (!isValidObjectId && !isNumericId) {
        console.error("[commentsApi] Invalid post ID format:", rawPostId);
        throw new Error("Invalid post ID format. Cannot create comment.");
      }
      
      // Validate required fields
      if (!data.text || !data.text.trim()) {
        throw new Error("Comment text is required");
      }
      
      if (!data.authorUsername) {
        throw new Error("You must be logged in to comment");
      }
      
      // Look up the Payload CMS user ID by username
      let authorId: string | undefined;
      
      // Check cache first
      if (userIdCache[data.authorUsername]) {
        authorId = userIdCache[data.authorUsername];
        console.log("[commentsApi] Using cached author ID:", authorId);
      } else {
        // Look up user in Payload CMS
        try {
          const userResult = await users.find({
            where: { username: { equals: data.authorUsername } },
            limit: 1,
          });
          
          if (userResult.docs && userResult.docs.length > 0) {
            authorId = (userResult.docs[0] as { id: string }).id;
            userIdCache[data.authorUsername] = authorId;
            console.log("[commentsApi] Found author ID:", authorId);
          } else {
            console.error("[commentsApi] User not found in CMS:", data.authorUsername);
            throw new Error("User not found. Please log out and log back in.");
          }
        } catch (lookupError) {
          console.error("[commentsApi] User lookup error:", lookupError);
          throw new Error("Failed to verify user. Please try again.");
        }
      }
      
      if (!authorId) {
        throw new Error("Could not identify user. Please log out and log back in.");
      }
      
      const commentPayload = {
        post: postId, // Use cleaned/parsed post ID
        content: data.text.trim(), // CMS expects 'content' field
        author: authorId,
        parent: data.parent || undefined,
      };
      console.log("[commentsApi] Sending to API:", JSON.stringify(commentPayload));
      const doc = await commentsApi.create(commentPayload as any);
      const createdComment = transformComment(doc as Record<string, unknown>);
      
      // Create notifications for mentions and post author (don't fail if notification creation fails)
      try {
        const commentText = data.text.trim();
        const mentions = extractMentions(commentText);
        
        // Get post details to notify the author
        let postAuthorId: string | undefined;
        try {
          const postDoc = await posts.findByID(String(postId));
          const postAuthor = (postDoc as Record<string, unknown>)?.author;
          if (typeof postAuthor === 'object' && postAuthor !== null) {
            postAuthorId = String((postAuthor as Record<string, unknown>).id);
          } else if (typeof postAuthor === 'string') {
            postAuthorId = postAuthor;
          }
        } catch (postError) {
          console.log("[commentsApi] Could not fetch post for notification:", postError);
        }
        
        // Notify post author if it's not the commenter
        if (postAuthorId && postAuthorId !== authorId) {
          try {
            await notifications.create({
              type: "comment",
              recipient: postAuthorId,
              sender: authorId,
              post: postId,
              content: commentText.slice(0, 100),
            });
            console.log("[commentsApi] Created comment notification for post author");
          } catch (notifError) {
            console.log("[commentsApi] Failed to create post author notification:", notifError);
          }
        }
        
        // Create notifications for mentioned users
        for (const mentionedUsername of mentions) {
          // Skip self-mentions
          if (mentionedUsername.toLowerCase() === data.authorUsername?.toLowerCase()) {
            continue;
          }
          
          try {
            // Look up the mentioned user
            const mentionedUserResult = await users.find({
              where: { username: { equals: mentionedUsername } },
              limit: 1,
            });
            
            if (mentionedUserResult.docs && mentionedUserResult.docs.length > 0) {
              const mentionedUserId = (mentionedUserResult.docs[0] as { id: string }).id;
              
              // Don't notify if they're already the post author (already notified above)
              if (mentionedUserId === postAuthorId) continue;
              
              await notifications.create({
                type: "mention",
                recipient: mentionedUserId,
                sender: authorId,
                post: postId,
                content: commentText.slice(0, 100),
              });
              console.log("[commentsApi] Created mention notification for:", mentionedUsername);
            }
          } catch (mentionError) {
            console.log("[commentsApi] Failed to create mention notification for", mentionedUsername, ":", mentionError);
          }
        }
      } catch (notificationError) {
        console.error("[commentsApi] Notification creation error (comment still created):", notificationError);
      }
      
      return createdComment;
    } catch (error) {
      console.error("[commentsApi] createComment error:", error);
      throw error;
    }
  },
};
