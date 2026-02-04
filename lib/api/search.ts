import { supabase } from '../supabase/client';
import { DB } from '../supabase/db-map';

export const searchApi = {
  /**
   * Search posts by content
   */
  async searchPosts(query: string, limit: number = 50) {
    try {
      console.log('[Search] searchPosts, query:', query);
      
      if (!query || query.length < 1) {
        return { docs: [], totalDocs: 0 };
      }

      const { data, error, count } = await supabase
        .from(DB.posts.table)
        .select(`
          *,
          author:${DB.posts.authorId}(
            ${DB.users.id},
            ${DB.users.username},
            ${DB.users.firstName},
            ${DB.users.verified},
            avatar:${DB.users.avatarId}(url)
          ),
          media:posts_media(
            type,
            url
          )
        `, { count: 'exact' })
        .ilike(DB.posts.content, `%${query}%`)
        .eq(DB.posts.visibility, 'public')
        .order(DB.posts.createdAt, { ascending: false })
        .limit(limit);

      if (error) throw error;

      const docs = (data || []).map((post: any) => ({
        id: String(post[DB.posts.id]),
        author: {
          username: post.author?.[DB.users.username] || 'unknown',
          avatar: post.author?.avatar?.url || '',
          verified: post.author?.[DB.users.verified] || false,
          name: post.author?.[DB.users.firstName] || post.author?.[DB.users.username] || 'Unknown',
        },
        media: (post.media || []).map((m: any) => ({
          type: m.type || 'image',
          url: m.url || '',
        })),
        caption: post[DB.posts.content] || '',
        likes: Number(post[DB.posts.likesCount]) || 0,
        comments: [],
        timeAgo: formatTimeAgo(post[DB.posts.createdAt]),
        location: post[DB.posts.location],
      }));

      return { docs, totalDocs: count || 0 };
    } catch (error) {
      console.error('[Search] searchPosts error:', error);
      return { docs: [], totalDocs: 0 };
    }
  },

  /**
   * Search users by username or name
   */
  async searchUsers(query: string, limit: number = 50) {
    try {
      console.log('[Search] searchUsers, query:', query);
      
      if (!query || query.length < 1) {
        return { docs: [], totalDocs: 0 };
      }

      const { data, error, count } = await supabase
        .from(DB.users.table)
        .select(`
          ${DB.users.id},
          ${DB.users.username},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.verified},
          ${DB.users.followersCount},
          avatar:${DB.users.avatarId}(url)
        `, { count: 'exact' })
        .or(`${DB.users.username}.ilike.%${query}%,${DB.users.firstName}.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      const docs = (data || []).map((user: any) => ({
        id: String(user[DB.users.id]),
        username: user[DB.users.username] || 'unknown',
        name: user[DB.users.firstName] || user[DB.users.username] || 'Unknown',
        avatar: user.avatar?.url || '',
        bio: user[DB.users.bio] || '',
        verified: user[DB.users.verified] || false,
        followersCount: Number(user[DB.users.followersCount]) || 0,
      }));

      return { docs, totalDocs: count || 0 };
    } catch (error) {
      console.error('[Search] searchUsers error:', error);
      return { docs: [], totalDocs: 0 };
    }
  },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}
