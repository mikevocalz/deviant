import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { transformPost } from "@/lib/api/posts";
import type { Post } from "@/lib/types";

const SEARCH_POST_SELECT = `
  ${DB.posts.id},
  ${DB.posts.authorId},
  ${DB.posts.content},
  ${DB.posts.postKind},
  ${DB.posts.textTheme},
  ${DB.posts.likesCount},
  ${DB.posts.commentsCount},
  ${DB.posts.isNsfw},
  ${DB.posts.location},
  ${DB.posts.createdAt},
  author:users!posts_author_id_users_id_fk(
    ${DB.users.id},
    ${DB.users.username},
    ${DB.users.firstName},
    ${DB.users.verified},
    avatar:${DB.users.avatarId}(url)
  ),
  media:posts_media(
    ${DB.postsMedia.type},
    ${DB.postsMedia.url},
    ${DB.postsMedia.order},
    ${DB.postsMedia.mimeType},
    ${DB.postsMedia.livePhotoVideoUrl}
  ),
  post_text_slides(
    ${DB.postTextSlides.id},
    ${DB.postTextSlides.slideIndex},
    ${DB.postTextSlides.content}
  )
`;

function applySearchBoundary(query: any, includeNsfw: boolean) {
  if (includeNsfw) return query;
  return query.eq(DB.posts.isNsfw, false);
}

async function fetchSearchPostsByIds(postIds: string[], includeNsfw: boolean) {
  if (postIds.length === 0) return [];

  const query = applySearchBoundary(
    supabase
      .from(DB.posts.table)
      .select(SEARCH_POST_SELECT)
      .in(DB.posts.id, postIds)
      .eq(DB.posts.visibility, "public")
      .order(DB.posts.createdAt, { ascending: false }),
    includeNsfw,
  );

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((post: any) => transformPost(post, false));
}

export const searchApi = {
  /**
   * Search posts by content
   */
  async searchPosts(
    query: string,
    limit: number = 50,
    options?: { includeNsfw?: boolean },
  ) {
    try {
      console.log("[Search] searchPosts, query:", query);
      const includeNsfw = options?.includeNsfw === true;

      const normalizedQuery = query.trim();

      if (!normalizedQuery || normalizedQuery.length < 1) {
        return { docs: [], totalDocs: 0 };
      }

      const searchPattern = `%${normalizedQuery}%`;

      const contentQuery = applySearchBoundary(
        supabase
          .from(DB.posts.table)
          .select(SEARCH_POST_SELECT)
          .ilike(DB.posts.content, searchPattern)
          .eq(DB.posts.visibility, "public")
          .order(DB.posts.createdAt, { ascending: false })
          .limit(limit * 2),
        includeNsfw,
      );

      let slideQuery = supabase
        .from(DB.postTextSlides.table)
        .select(
          `
              ${DB.postTextSlides.postId},
              post:posts!inner(
                ${DB.posts.id},
                ${DB.posts.visibility},
                ${DB.posts.isNsfw}
              )
            `,
        )
        .ilike(DB.postTextSlides.content, searchPattern)
        .eq("post.visibility", "public")
        .limit(limit * 4);

      if (!includeNsfw) {
        slideQuery = slideQuery.eq("post.is_nsfw", false);
      }

      const [
        { data: contentMatches, error: contentError },
        { data: slideRows, error: slideError },
      ] = await Promise.all([contentQuery, slideQuery]);

      if (contentError) throw contentError;
      if (slideError) throw slideError;

      const contentPosts: Post[] = (contentMatches || []).map((post: any) =>
        transformPost(post, false),
      );
      const seenPostIds = new Set(contentPosts.map((post) => post.id));
      const extraSlidePostIds = Array.from(
        new Set(
          (slideRows || [])
            .map((row: any) => row?.[DB.postTextSlides.postId])
            .filter(
              (postId): postId is string | number =>
                postId !== null && postId !== undefined,
            )
            .map((postId) => String(postId)),
        ),
      ).filter((postId) => !seenPostIds.has(postId));

      const extraSlidePosts = await fetchSearchPostsByIds(
        extraSlidePostIds.slice(0, limit * 2),
        includeNsfw,
      );

      const docs = [...contentPosts, ...extraSlidePosts]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, limit);

      return { docs, totalDocs: docs.length };
    } catch (error) {
      console.error("[Search] searchPosts error:", error);
      return { docs: [], totalDocs: 0 };
    }
  },

  /**
   * Search users by username or name
   */
  async searchUsers(query: string, limit: number = 50) {
    try {
      console.log("[Search] searchUsers, query:", query);

      if (!query || query.length < 1) {
        return { docs: [], totalDocs: 0 };
      }

      const { data, error, count } = await supabase
        .from(DB.users.table)
        .select(
          `
          ${DB.users.id},
          ${DB.users.username},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.verified},
          ${DB.users.followersCount},
          avatar:${DB.users.avatarId}(url)
        `,
          { count: "exact" },
        )
        .or(
          `${DB.users.username}.ilike.%${query}%,${DB.users.firstName}.ilike.%${query}%`,
        )
        .limit(limit);

      if (error) throw error;

      const docs = (data || []).map((user: any) => ({
        id: String(user[DB.users.id]),
        username: user[DB.users.username] || "unknown",
        name: user[DB.users.firstName] || user[DB.users.username] || "Unknown",
        avatar: user.avatar?.url || "",
        bio: user[DB.users.bio] || "",
        verified: user[DB.users.verified] || false,
        followersCount: Number(user[DB.users.followersCount]) || 0,
      }));

      return { docs, totalDocs: count || 0 };
    } catch (error) {
      console.error("[Search] searchUsers error:", error);
      return { docs: [], totalDocs: 0 };
    }
  },
};
