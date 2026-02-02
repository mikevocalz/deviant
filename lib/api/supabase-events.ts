import { supabase } from '../supabase/client';
import { DB } from '../supabase/db-map';

export const eventsApi = {
  /**
   * Get upcoming events
   */
  async getEvents(limit: number = 20, category?: string) {
    try {
      console.log('[Events] getEvents');
      
      const now = new Date().toISOString();
      let query = supabase
        .from(DB.events.table)
        .select(`
          *,
          host:${DB.events.hostId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          )
        `)
        .gte(DB.events.startDate, now)
        .order(DB.events.startDate, { ascending: true })
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((event: any) => ({
        id: String(event[DB.events.id]),
        title: event[DB.events.title],
        description: event[DB.events.description],
        date: event[DB.events.startDate],
        location: event[DB.events.location],
        image: event[DB.events.coverImageUrl] || '',
        price: Number(event[DB.events.price]) || 0,
        attendees: Number(event[DB.events.totalAttendees]) || 0,
        host: {
          username: event.host?.[DB.users.username] || 'unknown',
          avatar: event.host?.avatar?.url || '',
        },
      }));
    } catch (error) {
      console.error('[Events] getEvents error:', error);
      return [];
    }
  },

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit: number = 20) {
    return this.getEvents(limit);
  },

  /**
   * Get past events
   */
  async getPastEvents(limit: number = 20) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from(DB.events.table)
        .select(`
          *,
          host:${DB.events.hostId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          )
        `)
        .lt(DB.events.startDate, now)
        .order(DB.events.startDate, { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((event: any) => ({
        id: String(event[DB.events.id]),
        title: event[DB.events.title],
        description: event[DB.events.description],
        date: event[DB.events.startDate],
        location: event[DB.events.location],
        image: event[DB.events.coverImageUrl] || '',
        price: Number(event[DB.events.price]) || 0,
        attendees: Number(event[DB.events.totalAttendees]) || 0,
        host: {
          username: event.host?.[DB.users.username] || 'unknown',
          avatar: event.host?.avatar?.url || '',
        },
      }));
    } catch (error) {
      console.error('[Events] getPastEvents error:', error);
      return [];
    }
  },

  /**
   * Get single event
   */
  async getEventById(id: string) {
    try {
      const { data, error } = await supabase
        .from(DB.events.table)
        .select(`
          *,
          host:${DB.events.hostId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          )
        `)
        .eq(DB.events.id, parseInt(id))
        .single();

      if (error) throw error;

      return {
        id: String(data[DB.events.id]),
        title: data[DB.events.title],
        description: data[DB.events.description],
        date: data[DB.events.startDate],
        location: data[DB.events.location],
        image: data[DB.events.coverImageUrl] || '',
        price: Number(data[DB.events.price]) || 0,
        attendees: Number(data[DB.events.totalAttendees]) || 0,
        maxAttendees: Number(data[DB.events.maxAttendees]),
        host: {
          username: data.host?.[DB.users.username] || 'unknown',
          avatar: data.host?.avatar?.url || '',
        },
      };
    } catch (error) {
      console.error('[Events] getEventById error:', error);
      return null;
    }
  },

  /**
   * RSVP to event
   */
  async rsvpEvent(eventId: string, status: 'going' | 'interested' | 'not_going') {
    try {
      console.log('[Events] rsvpEvent:', eventId, status);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) throw new Error('User not found');

      // Check if RSVP exists
      const { data: existing } = await supabase
        .from(DB.eventRsvps.table)
        .select('*')
        .eq(DB.eventRsvps.eventId, parseInt(eventId))
        .eq(DB.eventRsvps.userId, userData[DB.users.id])
        .single();

      if (existing) {
        // Update existing RSVP
        const { error } = await supabase
          .from(DB.eventRsvps.table)
          .update({ [DB.eventRsvps.status]: status })
          .eq(DB.eventRsvps.eventId, parseInt(eventId))
          .eq(DB.eventRsvps.userId, userData[DB.users.id]);

        if (error) throw error;
      } else {
        // Create new RSVP
        const { error } = await supabase
          .from(DB.eventRsvps.table)
          .insert({
            [DB.eventRsvps.eventId]: parseInt(eventId),
            [DB.eventRsvps.userId]: userData[DB.users.id],
            [DB.eventRsvps.status]: status,
          });

        if (error) throw error;

        // Increment attendees if going
        if (status === 'going') {
          await supabase.rpc('increment_event_attendees', { event_id: parseInt(eventId) });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('[Events] rsvpEvent error:', error);
      throw error;
    }
  },

  /**
   * Get user's RSVP status for event
   */
  async getUserRsvp(eventId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) return null;

      const { data, error } = await supabase
        .from(DB.eventRsvps.table)
        .select(DB.eventRsvps.status)
        .eq(DB.eventRsvps.eventId, parseInt(eventId))
        .eq(DB.eventRsvps.userId, userData[DB.users.id])
        .single();

      if (error) return null;

      return data[DB.eventRsvps.status];
    } catch (error) {
      console.error('[Events] getUserRsvp error:', error);
      return null;
    }
  },

  /**
   * Create new event
   */
  async createEvent(eventData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) throw new Error('User not found');

      const { data, error } = await supabase
        .from(DB.events.table)
        .insert({
          [DB.events.hostId]: userData[DB.users.id],
          [DB.events.title]: eventData.title,
          [DB.events.description]: eventData.description,
          [DB.events.startDate]: eventData.date,
          [DB.events.location]: eventData.location,
          [DB.events.coverImageUrl]: eventData.image,
          [DB.events.price]: eventData.price || 0,
          [DB.events.maxAttendees]: eventData.maxAttendees,
          [DB.events.isOnline]: eventData.isOnline || false,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[Events] createEvent error:', error);
      throw error;
    }
  },
};
