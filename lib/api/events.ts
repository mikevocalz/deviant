import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserId } from "./auth-helper";

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

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Check if RSVP exists
      const { data: existing } = await supabase
        .from(DB.eventRsvps.table)
        .select("*")
        .eq(DB.eventRsvps.eventId, parseInt(eventId))
        .eq(DB.eventRsvps.userId, parseInt(userId))
        .single();

      if (existing) {
        // Update existing RSVP
        const { error } = await supabase
          .from(DB.eventRsvps.table)
          .update({ [DB.eventRsvps.status]: status })
          .eq(DB.eventRsvps.eventId, parseInt(eventId))
          .eq(DB.eventRsvps.userId, parseInt(userId));

        if (error) throw error;
      } else {
        // Create new RSVP
        const { error } = await supabase.from(DB.eventRsvps.table).insert({
          [DB.eventRsvps.eventId]: parseInt(eventId),
          [DB.eventRsvps.userId]: parseInt(userId),
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
      const userId = getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from(DB.eventRsvps.table)
        .select(DB.eventRsvps.status)
        .eq(DB.eventRsvps.eventId, parseInt(eventId))
        .eq(DB.eventRsvps.userId, parseInt(userId))
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

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Use userId for host_id
      const { data, error } = await supabase
        .from(DB.events.table)
        .insert({
          [DB.events.hostId]: userId,
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
   * Update event (only host or co-organizer can update)
   */
  async updateEvent(eventId: string, updates: any) {
    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Check if user is host or co-organizer
      const canEdit = await this.canEditEvent(eventId, userId);
      if (!canEdit) throw new Error("Not authorized to edit this event");

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
   * Delete event (only host can delete)
   */
  async deleteEvent(eventId: string) {
    try {
      console.log("[Events] deleteEvent:", eventId);

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Delete co-organizers first
      await supabase
        .from("event_co_organizers")
        .delete()
        .eq("event_id", parseInt(eventId));

      // Delete RSVPs
      await supabase
        .from(DB.eventRsvps.table)
        .delete()
        .eq(DB.eventRsvps.eventId, parseInt(eventId));

      // Delete event (only if user is host)
      const { error } = await supabase
        .from(DB.events.table)
        .delete()
        .eq(DB.events.id, parseInt(eventId))
        .eq(DB.events.hostId, userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[Events] deleteEvent error:", error);
      throw error;
    }
  },

  /**
   * Check if user can edit event (is host or co-organizer)
   */
  async canEditEvent(eventId: string, userId: string): Promise<boolean> {
    try {
      // Check if user is host
      const { data: event } = await supabase
        .from(DB.events.table)
        .select(DB.events.hostId)
        .eq(DB.events.id, parseInt(eventId))
        .single();

      if (event && event[DB.events.hostId] === userId) {
        return true;
      }

      // Check if user is co-organizer
      const { data: coOrg } = await supabase
        .from("event_co_organizers")
        .select("id")
        .eq("event_id", parseInt(eventId))
        .eq("user_id", parseInt(userId))
        .single();

      return !!coOrg;
    } catch (error) {
      return false;
    }
  },

  /**
   * Add co-organizer to event (only host can add)
   */
  async addCoOrganizer(eventId: string, coOrganizerUserId: string) {
    try {
      console.log("[Events] addCoOrganizer:", eventId, coOrganizerUserId);

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Verify user is the host
      const { data: event } = await supabase
        .from(DB.events.table)
        .select(DB.events.hostId)
        .eq(DB.events.id, parseInt(eventId))
        .single();

      if (!event || event[DB.events.hostId] !== userId) {
        throw new Error("Only the host can add co-organizers");
      }

      // Add co-organizer
      const { data, error } = await supabase
        .from("event_co_organizers")
        .insert({
          event_id: parseInt(eventId),
          user_id: parseInt(coOrganizerUserId),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error("[Events] addCoOrganizer error:", error);
      throw error;
    }
  },

  /**
   * Remove co-organizer from event (only host can remove)
   */
  async removeCoOrganizer(eventId: string, coOrganizerUserId: string) {
    try {
      console.log("[Events] removeCoOrganizer:", eventId, coOrganizerUserId);

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Verify user is the host
      const { data: event } = await supabase
        .from(DB.events.table)
        .select(DB.events.hostId)
        .eq(DB.events.id, parseInt(eventId))
        .single();

      if (!event || event[DB.events.hostId] !== userId) {
        throw new Error("Only the host can remove co-organizers");
      }

      // Remove co-organizer
      const { error } = await supabase
        .from("event_co_organizers")
        .delete()
        .eq("event_id", parseInt(eventId))
        .eq("user_id", parseInt(coOrganizerUserId));

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[Events] removeCoOrganizer error:", error);
      throw error;
    }
  },

  /**
   * Get co-organizers for an event
   */
  async getCoOrganizers(eventId: string) {
    try {
      const { data, error } = await supabase
        .from("event_co_organizers")
        .select(
          `
          user:user_id(
            id,
            username,
            first_name,
            avatar:avatar_id(url)
          )
        `,
        )
        .eq("event_id", parseInt(eventId));

      if (error) {
        console.log(
          "[Events] getCoOrganizers - table may not exist:",
          error.message,
        );
        return [];
      }

      return (data || []).map((co: any) => ({
        id: String(co.user?.id),
        username: co.user?.username || "unknown",
        name: co.user?.first_name || co.user?.username || "Unknown",
        avatar: co.user?.avatar?.url || "",
      }));
    } catch (error) {
      console.error("[Events] getCoOrganizers error:", error);
      return [];
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
