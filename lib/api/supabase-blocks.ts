import { supabase } from '../supabase/client';
import { DB } from '../supabase/db-map';

export const blocksApi = {
  /**
   * Get blocked users for current user
   */
  async getBlockedUsers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return [];

      // Note: This assumes a 'blocks' table exists in the schema
      // If not, this will return empty array
      const { data, error } = await supabase
        .from('blocks')
        .select(`
          id,
          created_at,
          blocked:blocked_id(
            id,
            username,
            first_name,
            last_name,
            avatar:avatar_id(url)
          )
        `)
        .eq('blocker_id', userData[DB.users.id]);

      if (error) {
        console.log('[Blocks] getBlockedUsers - table may not exist:', error.message);
        return [];
      }

      return (data || []).map((block: any) => ({
        id: String(block.id),
        blockId: String(block.id),
        userId: String(block.blocked?.id),
        username: block.blocked?.username || 'unknown',
        name: block.blocked?.first_name || block.blocked?.username || 'Unknown',
        avatar: block.blocked?.avatar?.url || null,
        blockedAt: block.created_at,
      }));
    } catch (error) {
      console.error('[Blocks] getBlockedUsers error:', error);
      return [];
    }
  },

  /**
   * Block a user
   */
  async blockUser(userId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error('User not found');

      const { data, error } = await supabase
        .from('blocks')
        .insert({
          blocker_id: userData[DB.users.id],
          blocked_id: parseInt(userId),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('[Blocks] blockUser error:', error);
      throw error;
    }
  },

  /**
   * Unblock a user
   */
  async unblockUser(blockId: string) {
    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('id', blockId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[Blocks] unblockUser error:', error);
      throw error;
    }
  },
};
