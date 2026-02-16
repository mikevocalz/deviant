/**
 * Bootstrap API Client
 *
 * Single-request data loaders for each core screen.
 * Falls back gracefully to individual queries on failure.
 *
 * Feature-flagged via perf_bootstrap_* flags.
 */

import { supabase } from "../supabase/client";

export interface BootstrapFeedResponse {
  posts: BootstrapPost[];
  stories: BootstrapStory[];
  viewer: BootstrapViewer;
  nextCursor: number | null;
  hasMore: boolean;
  _meta?: { elapsed: number; postCount: number; storyCount: number };
}

export interface BootstrapPost {
  id: string;
  caption: string;
  createdAt: string;
  isNSFW: boolean;
  location: string | null;
  likes: number;
  commentsCount: number;
  viewerHasLiked: boolean;
  viewerHasBookmarked: boolean;
  author: {
    id?: string;
    username: string;
    firstName: string;
    avatar: string;
    verified: boolean;
  };
  media: { type: string; url: string }[];
}

export interface BootstrapStory {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  latestThumbnail: string;
  itemCount: number;
}

export interface BootstrapViewer {
  id: string;
  username: string;
  avatarUrl: string;
  unreadMessages: number;
  unreadNotifications: number;
}

export interface BootstrapProfileResponse {
  profile: {
    id: string;
    authId: string;
    username: string;
    firstName: string;
    bio: string;
    website: string;
    location: string;
    avatarUrl: string;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    verified: boolean;
    viewerIsFollowing: boolean;
    viewerIsFollowedBy: boolean;
  };
  posts: { id: string; thumbnailUrl: string; type: string; likesCount: number }[];
  nextCursor: number | null;
  hasMore: boolean;
}

export interface BootstrapNotificationsResponse {
  activities: {
    id: string;
    type: string;
    createdAt: string;
    isRead: boolean;
    actor: { id: string; username: string; avatarUrl: string };
    entityType?: string;
    entityId?: string;
    post?: { id: string; thumbnailUrl: string };
    event?: { id: string; title: string };
    commentText?: string;
  }[];
  unreadCount: number;
  viewerFollowing: Record<string, boolean>;
}

export const bootstrapApi = {
  /**
   * Feed bootstrap — all above-the-fold data in one request.
   */
  async feed(params: {
    userId: string;
    cursor?: number;
    limit?: number;
  }): Promise<BootstrapFeedResponse | null> {
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.functions.invoke(
        "bootstrap-feed",
        {
          body: {
            user_id: params.userId,
            cursor: params.cursor || 0,
            limit: params.limit || 20,
          },
        },
      );

      if (error) throw error;

      const elapsed = Date.now() - t0;
      console.log(`[Bootstrap] Feed loaded in ${elapsed}ms — ${data?.posts?.length || 0} posts, ${data?.stories?.length || 0} stories`);

      return data as BootstrapFeedResponse;
    } catch (err) {
      console.error("[Bootstrap] Feed error:", err);
      return null;
    }
  },

  /**
   * Profile bootstrap — profile header + first page of posts.
   */
  async profile(params: {
    userId: string;
    viewerId?: string;
  }): Promise<BootstrapProfileResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "bootstrap-profile",
        {
          body: {
            user_id: params.userId,
            viewer_id: params.viewerId,
          },
        },
      );

      if (error) throw error;
      return data as BootstrapProfileResponse;
    } catch (err) {
      console.error("[Bootstrap] Profile error:", err);
      return null;
    }
  },

  /**
   * Notifications bootstrap — activities + follow state + unread count.
   */
  async notifications(params: {
    userId: string;
    limit?: number;
  }): Promise<BootstrapNotificationsResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "bootstrap-notifications",
        {
          body: {
            user_id: params.userId,
            limit: params.limit || 50,
          },
        },
      );

      if (error) throw error;
      return data as BootstrapNotificationsResponse;
    } catch (err) {
      console.error("[Bootstrap] Notifications error:", err);
      return null;
    }
  },
};
