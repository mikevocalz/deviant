import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";

export const eventsApi = {
  /**
   * Get upcoming events
   */
  async getEvents(limit: number = 20, category?: string) {
    try {
      console.log("[Events] getEvents");

      const now = new Date().toISOString();
      // Don't use join since host_id is UUID without foreign key
      const { data, error } = await supabase
        .from(DB.events.table)
        .select("*")
        .gte(DB.events.startDate, now)
        .order(DB.events.startDate, { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Fetch host data separately
      const hostIds = [
        ...new Set(
          (data || []).map((e: any) => e[DB.events.hostId]).filter(Boolean),
        ),
      ];
      let hostsMap = new Map();

      if (hostIds.length > 0) {
        const { data: hosts } = await supabase
          .from(DB.users.table)
          .select(
            `${DB.users.id}, ${DB.users.authId}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
          )
          .in(DB.users.authId, hostIds);

        hostsMap = new Map(
          (hosts || []).map((h: any) => [h[DB.users.authId], h]),
        );
      }

      return (data || []).map((event: any) => {
        const host = hostsMap.get(event[DB.events.hostId]);
        return {
          id: String(event[DB.events.id]),
          title: event[DB.events.title],
          description: event[DB.events.description],
          date: event[DB.events.startDate],
          location: event[DB.events.location],
          image: event[DB.events.coverImageUrl] || "",
          price: Number(event[DB.events.price]) || 0,
          attendees: Number(event[DB.events.totalAttendees]) || 0,
          host: {
            username: host?.[DB.users.username] || "unknown",
            avatar: host?.avatar?.url || "",
          },
        };
      });
    } catch (error) {
      console.error("[Events] getEvents error:", error);
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
        .select("*")
        .lt(DB.events.startDate, now)
        .order(DB.events.startDate, { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Fetch host data separately
      const hostIds = [
        ...new Set(
          (data || []).map((e: any) => e[DB.events.hostId]).filter(Boolean),
        ),
      ];
      let hostsMap = new Map();

      if (hostIds.length > 0) {
        const { data: hosts } = await supabase
          .from(DB.users.table)
          .select(
            `${DB.users.id}, ${DB.users.authId}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
          )
          .in(DB.users.authId, hostIds);

        hostsMap = new Map(
          (hosts || []).map((h: any) => [h[DB.users.authId], h]),
        );
      }

      return (data || []).map((event: any) => {
        const host = hostsMap.get(event[DB.events.hostId]);
        return {
          id: String(event[DB.events.id]),
          title: event[DB.events.title],
          description: event[DB.events.description],
          date: event[DB.events.startDate],
          location: event[DB.events.location],
          image: event[DB.events.coverImageUrl] || "",
          price: Number(event[DB.events.price]) || 0,
          attendees: Number(event[DB.events.totalAttendees]) || 0,
          host: {
            username: host?.[DB.users.username] || "unknown",
            avatar: host?.avatar?.url || "",
          },
        };
      });
    } catch (error) {
      console.error("[Events] getPastEvents error:", error);
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
        .select("*")
        .eq(DB.events.id, parseInt(id))
        .single();

      if (error) throw error;

      // Fetch host data separately
      let host = null;
      if (data[DB.events.hostId]) {
        const { data: hostData } = await supabase
          .from(DB.users.table)
          .select(
            `${DB.users.id}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
          )
          .eq(DB.users.authId, data[DB.events.hostId])
          .single();
        host = hostData;
      }

      return {
        id: String(data[DB.events.id]),
        title: data[DB.events.title],
        description: data[DB.events.description],
        date: data[DB.events.startDate],
        location: data[DB.events.location],
        image: data[DB.events.coverImageUrl] || "",
        price: Number(data[DB.events.price]) || 0,
        attendees: Number(data[DB.events.totalAttendees]) || 0,
        maxAttendees: Number(data[DB.events.maxAttendees]),
        host: {
          id: host?.[DB.users.id] ? String(host[DB.users.id]) : undefined,
          username: host?.[DB.users.username] || "unknown",
          avatar: (host?.avatar as any)?.url || "",
        },
        coOrganizer: null, // Not yet implemented in schema
      };
    } catch (error) {
      console.error("[Events] getEventById error:", error);
      return null;
    }
  },

  /**
   * RSVP to event
   */
  async rsvpEvent(
    eventId: string,
    status: "going" | "interested" | "not_going",
  ) {
    try {
      console.log("[Events] rsvpEvent:", eventId, status);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error("User not found");

      // Check if RSVP exists
      const { data: existing } = await supabase
        .from(DB.eventRsvps.table)
        .select("*")
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
        const { error } = await supabase.from(DB.eventRsvps.table).insert({
          [DB.eventRsvps.eventId]: parseInt(eventId),
          [DB.eventRsvps.userId]: userData[DB.users.id],
          [DB.eventRsvps.status]: status,
        });

        if (error) throw error;

        // Increment attendees if going
        if (status === "going") {
          await supabase.rpc("increment_event_attendees", {
            event_id: parseInt(eventId),
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error("[Events] rsvpEvent error:", error);
      throw error;
    }
  },

  /**
   * Get user's RSVP status for event
   */
  async getUserRsvp(eventId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
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
      console.error("[Events] getUserRsvp error:", error);
      return null;
    }
  },

  /**
   * Create new event
   */
  async createEvent(eventData: any) {
    try {
      console.log("[Events] createEvent");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Use user.id (UUID) for host_id since events.host_id is UUID type
      const { data, error } = await supabase
        .from(DB.events.table)
        .insert({
          [DB.events.hostId]: user.id, // UUID from Supabase auth
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

      console.log("[Events] Event created:", data?.id);

      // Return formatted event data for optimistic updates
      return {
        id: String(data[DB.events.id]),
        title: data[DB.events.title],
        description: data[DB.events.description],
        date: data[DB.events.startDate],
        location: data[DB.events.location],
        image: data[DB.events.coverImageUrl] || "",
        price: Number(data[DB.events.price]) || 0,
        attendees: 0,
        host: {
          username: "You",
          avatar: "",
        },
      };
    } catch (error) {
      console.error("[Events] createEvent error:", error);
      throw error;
    }
  },

  /**
   * Update event
   */
  async updateEvent(eventId: string, updates: any) {
    try {
      const updateData: any = {};
      if (updates.title) updateData[DB.events.title] = updates.title;
      if (updates.description)
        updateData[DB.events.description] = updates.description;
      if (updates.date) updateData[DB.events.startDate] = updates.date;
      if (updates.location) updateData[DB.events.location] = updates.location;
      if (updates.coverImage)
        updateData[DB.events.coverImageUrl] = updates.coverImage;
      if (updates.price !== undefined)
        updateData[DB.events.price] = updates.price;
      if (updates.maxAttendees !== undefined)
        updateData[DB.events.maxAttendees] = updates.maxAttendees;

      const { data, error } = await supabase
        .from(DB.events.table)
        .update(updateData)
        .eq(DB.events.id, eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[Events] updateEvent error:", error);
      throw error;
    }
  },

  /**
   * Delete event
   */
  async deleteEvent(eventId: string) {
    try {
      console.log("[Events] deleteEvent:", eventId);

      // Delete RSVPs first
      await supabase
        .from(DB.eventRsvps.table)
        .delete()
        .eq(DB.eventRsvps.eventId, parseInt(eventId));

      // Delete event
      const { error } = await supabase
        .from(DB.events.table)
        .delete()
        .eq(DB.events.id, parseInt(eventId));

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[Events] deleteEvent error:", error);
      throw error;
    }
  },

  /**
   * Get event comments (placeholder - schema may not support this yet)
   */
  async getEventComments(_eventId: string, _limit: number = 10) {
    console.log(
      "[Events] getEventComments - not yet implemented in Supabase schema",
    );
    return [];
  },

  /**
   * Add event comment (placeholder - schema may not support this yet)
   */
  async addEventComment(_eventId: string, _content: string) {
    console.log(
      "[Events] addEventComment - not yet implemented in Supabase schema",
    );
    throw new Error("Event comments not yet implemented");
  },

  /**
   * Get event reviews (placeholder - schema may not support this yet)
   */
  async getEventReviews(_eventId: string, _limit: number = 10) {
    console.log(
      "[Events] getEventReviews - not yet implemented in Supabase schema",
    );
    return [];
  },

  /**
   * Add event review (placeholder - schema may not support this yet)
   */
  async addEventReview(_eventId: string, _rating: number, _content: string) {
    console.log(
      "[Events] addEventReview - not yet implemented in Supabase schema",
    );
    throw new Error("Event reviews not yet implemented");
  },
};
