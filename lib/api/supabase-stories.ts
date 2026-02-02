import { supabase } from '../supabase/client';
import { DB } from '../supabase/db-map';

export const storiesApi = {
  /**
   * Get stories feed (active stories from followed users)
   */
  async getStories() {
    try {
      console.log('[Stories] getStories');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get current user ID
      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) return [];

      // Get non-expired stories from followed users + own stories
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from(DB.stories.table)
        .select(`
          *,
          author:${DB.stories.authorId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          ),
          media:${DB.stories.mediaId}(url)
        `)
        .gt(DB.stories.expiresAt, now)
        .order(DB.stories.createdAt, { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group by author
      const storiesByAuthor = new Map();
      
      (data || []).forEach((story: any) => {
        const authorId = story[DB.stories.authorId];
        if (!storiesByAuthor.has(authorId)) {
          storiesByAuthor.set(authorId, {
            id: String(authorId),
            username: story.author?.[DB.users.username] || 'unknown',
            avatar: story.author?.avatar?.url || '',
            hasStory: true,
            isViewed: false,
            isYou: authorId === userData[DB.users.id],
            stories: [],
          });
        }

        storiesByAuthor.get(authorId).stories.push({
          url: story.media?.url,
          type: story.media ? 'image' : 'text',
          duration: 5000,
          header: {
            heading: story.author?.[DB.users.username] || 'unknown',
            subheading: formatTimeAgo(story[DB.stories.createdAt]),
            profileImage: story.author?.avatar?.url || '',
          },
        });
      });

      return Array.from(storiesByAuthor.values());
    } catch (error) {
      console.error('[Stories] getStories error:', error);
      return [];
    }
  },

  /**
   * Create story
   */
  async createStory(mediaUrl: string, caption?: string) {
    try {
      console.log('[Stories] createStory');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) throw new Error('User not found');

      // Set expiry to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data, error } = await supabase
        .from(DB.stories.table)
        .insert({
          [DB.stories.authorId]: userData[DB.users.id],
          [DB.stories.caption]: caption,
          [DB.stories.expiresAt]: expiresAt.toISOString(),
          [DB.stories.visibility]: 'public',
          [DB.stories.viewCount]: 0,
          [DB.stories.viewersCount]: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[Stories] createStory error:', error);
      throw error;
    }
  },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours === 1) return '1h ago';
  return `${diffHours}h ago`;
}
