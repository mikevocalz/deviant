import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import {
  getCurrentUserId,
  getCurrentUserIdInt,
  getCurrentUserAuthId,
} from "./auth-helper";

/** Safely parse a JSONB array column (handles string, array, or null) */
function parseJsonbArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Resolve event image URL from multiple DB columns */
function resolveEventImage(event: any): string {
  // Priority: cover_image_url > image > cover_image_id (would need join)
  return event[DB.events.coverImageUrl] || event["image"] || "";
}

/** Format a raw ISO date into the fields the EventCard UI expects */
function formatEventDate(isoDate: string | null | undefined) {
  if (!isoDate) {
    return {
      date: "--",
      month: "---",
      fullDate: undefined as string | undefined,
      time: "",
    };
  }
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) {
    return {
      date: "--",
      month: "---",
      fullDate: undefined as string | undefined,
      time: "",
    };
  }
  return {
    date: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    fullDate: d.toISOString(),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export const eventsApi = {
  /**
   * Get upcoming events
   */
  async getEvents(limit: number = 20, category?: string) {
    try {
      console.log("[Events] getEvents");

      // Fetch ALL events with a valid start_date — UI tabs handle upcoming/past filtering
      const { data, error } = await supabase
        .from(DB.events.table)
        .select("*")
        .not(DB.events.startDate, "is", null)
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

      // Fetch RSVP attendees with avatars for event card avatar stacks
      const eventIds = (data || []).map((e: any) => e[DB.events.id]);
      const attendeesMap = new Map<
        number,
        { image?: string; initials?: string }[]
      >();

      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from(DB.eventRsvps.table)
          .select(`${DB.eventRsvps.eventId}, ${DB.eventRsvps.userId}`)
          .in(DB.eventRsvps.eventId, eventIds)
          .eq(DB.eventRsvps.status, "going");

        if (rsvps && rsvps.length > 0) {
          const rsvpAuthIds = [
            ...new Set(rsvps.map((r: any) => r[DB.eventRsvps.userId])),
          ];
          const { data: rsvpUsers } = await supabase
            .from(DB.users.table)
            .select(
              `${DB.users.authId}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
            )
            .in(DB.users.authId, rsvpAuthIds);

          const userMap = new Map(
            (rsvpUsers || []).map((u: any) => [u[DB.users.authId], u]),
          );

          for (const rsvp of rsvps) {
            const eid = rsvp[DB.eventRsvps.eventId];
            const u = userMap.get(rsvp[DB.eventRsvps.userId]);
            const attendee = {
              image: (u?.avatar as any)?.url || "",
              initials:
                u?.[DB.users.username]?.slice(0, 2)?.toUpperCase() || "??",
            };
            if (!attendeesMap.has(eid)) attendeesMap.set(eid, []);
            attendeesMap.get(eid)!.push(attendee);
          }
        }
      }

      return (data || []).map((event: any) => {
        const host = hostsMap.get(event[DB.events.hostId]);
        const dateParts = formatEventDate(event[DB.events.startDate]);
        const eid = event[DB.events.id];
        const rsvpAttendees = attendeesMap.get(eid) || [];
        const totalCount = Math.max(
          Number(event[DB.events.totalAttendees]) || 0,
          rsvpAttendees.length,
        );
        return {
          id: String(eid),
          title: event[DB.events.title],
          description: event[DB.events.description],
          ...dateParts,
          location: event[DB.events.location],
          image: resolveEventImage(event),
          images: parseJsonbArray(event[DB.events.images]),
          youtubeVideoUrl: event[DB.events.youtubeVideoUrl] || null,
          price: Number(event[DB.events.price]) || 0,
          likes: Number(event.likes) || 0,
          attendees: rsvpAttendees.length > 0 ? rsvpAttendees : totalCount,
          totalAttendees: totalCount,
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
   * Get events the current user is hosting or has RSVP'd to
   */
  async getMyEvents(limit: number = 50) {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return [];

      // Get events user RSVP'd to (event_rsvps.user_id is text/auth_id)
      const { data: rsvps } = await supabase
        .from(DB.eventRsvps.table)
        .select(DB.eventRsvps.eventId)
        .eq(DB.eventRsvps.userId, authId);

      const rsvpEventIds = (rsvps || []).map(
        (r: any) => r[DB.eventRsvps.eventId],
      );

      // Get events user is hosting + events they RSVP'd to
      // events.host_id is text/auth_id
      let query = supabase
        .from(DB.events.table)
        .select("*")
        .order(DB.events.startDate, { ascending: false })
        .limit(limit);

      // Combine: host_id match OR id in rsvp list
      if (rsvpEventIds.length > 0) {
        query = query.or(
          `${DB.events.hostId}.eq.${authId},${DB.events.id}.in.(${rsvpEventIds.join(",")})`,
        );
      } else {
        query = query.eq(DB.events.hostId, authId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((event: any) => {
        const dateParts = formatEventDate(event[DB.events.startDate]);
        return {
          id: String(event[DB.events.id]),
          title: event[DB.events.title],
          description: event[DB.events.description],
          ...dateParts,
          location: event[DB.events.location],
          image: resolveEventImage(event),
          price: Number(event[DB.events.price]) || 0,
          attendees: Number(event[DB.events.totalAttendees]) || 0,
        };
      });
    } catch (error) {
      console.error("[Events] getMyEvents error:", error);
      return [];
    }
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
        const dateParts = formatEventDate(event[DB.events.startDate]);
        return {
          id: String(event[DB.events.id]),
          title: event[DB.events.title],
          description: event[DB.events.description],
          ...dateParts,
          location: event[DB.events.location],
          image: resolveEventImage(event),
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

      console.log(
        "[Events] getEventById raw images:",
        JSON.stringify(data["images"]),
        "type:",
        typeof data["images"],
      );

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

      const dateParts = formatEventDate(data[DB.events.startDate]);
      return {
        id: String(data[DB.events.id]),
        title: data[DB.events.title],
        description: data[DB.events.description],
        ...dateParts,
        location: data[DB.events.location],
        image: resolveEventImage(data),
        images: parseJsonbArray(data[DB.events.images]),
        youtubeVideoUrl: data[DB.events.youtubeVideoUrl] || null,
        price: Number(data[DB.events.price]) || 0,
        likes: Number(data.likes) || 0,
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

      const authId = await getCurrentUserAuthId();
      if (!authId) throw new Error("Not authenticated");

      const eventIdInt = parseInt(eventId);

      // Check if RSVP exists (event_rsvps.user_id is text/auth_id)
      const { data: existing } = await supabase
        .from(DB.eventRsvps.table)
        .select("*")
        .eq(DB.eventRsvps.eventId, eventIdInt)
        .eq(DB.eventRsvps.userId, authId)
        .single();

      if (existing) {
        // Update existing RSVP
        const { error } = await supabase
          .from(DB.eventRsvps.table)
          .update({ [DB.eventRsvps.status]: status })
          .eq(DB.eventRsvps.eventId, eventIdInt)
          .eq(DB.eventRsvps.userId, authId);

        if (error) throw error;
      } else {
        // Create new RSVP
        const { error } = await supabase.from(DB.eventRsvps.table).insert({
          [DB.eventRsvps.eventId]: eventIdInt,
          [DB.eventRsvps.userId]: authId,
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
      const authId = await getCurrentUserAuthId();
      if (!authId) return null;

      const { data, error } = await supabase
        .from(DB.eventRsvps.table)
        .select(DB.eventRsvps.status)
        .eq(DB.eventRsvps.eventId, parseInt(eventId))
        .eq(DB.eventRsvps.userId, authId)
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

      const authId = await getCurrentUserAuthId();
      if (!authId) throw new Error("Not authenticated");

      // Use authId for host_id (text column)
      const { data, error } = await supabase
        .from(DB.events.table)
        .insert({
          [DB.events.hostId]: authId,
          [DB.events.title]: eventData.title,
          [DB.events.description]: eventData.description,
          [DB.events.startDate]: eventData.date,
          [DB.events.location]: eventData.location,
          [DB.events.coverImageUrl]: eventData.image,
          ["image"]: eventData.image,
          ["images"]: eventData.images || [],
          [DB.events.youtubeVideoUrl]: eventData.youtubeVideoUrl || null,
          [DB.events.price]: eventData.price || 0,
          [DB.events.maxAttendees]: eventData.maxAttendees,
          [DB.events.isOnline]: eventData.isOnline || false,
        })
        .select()
        .single();

      if (error) throw error;

      console.log("[Events] Event created:", data?.id);

      // Return formatted event data for optimistic updates
      const dateParts = formatEventDate(data[DB.events.startDate]);
      return {
        id: String(data[DB.events.id]),
        title: data[DB.events.title],
        description: data[DB.events.description],
        ...dateParts,
        location: data[DB.events.location],
        image: resolveEventImage(data),
        price: Number(data[DB.events.price]) || 0,
        attendees: 0,
        totalAttendees: 0,
        category: "Event",
        likes: 0,
        host: {
          username: "You",
          avatar: "",
        },
      };
    } catch (error: any) {
      console.error("[Events] createEvent error:", error);
      console.error("[Events] createEvent error code:", error?.code);
      console.error("[Events] createEvent error message:", error?.message);
      console.error("[Events] createEvent error details:", error?.details);
      console.error("[Events] createEvent error hint:", error?.hint);
      throw error;
    }
  },

  /**
   * Update event (only host or co-organizer can update)
   */
  async updateEvent(eventId: string, updates: any) {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) throw new Error("Not authenticated");

      // Check if user is host or co-organizer
      const canEdit = await this.canEditEvent(eventId, authId);
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
   * Also cleans up associated images from Bunny CDN
   */
  async deleteEvent(eventId: string) {
    try {
      console.log("[Events] deleteEvent:", eventId);

      const eventIdInt = parseInt(eventId);

      // Resolve all possible user identifiers for ownership check
      const authId = await getCurrentUserAuthId();
      const userIdInt = getCurrentUserIdInt();
      const userId = getCurrentUserId();
      console.log(
        "[Events] deleteEvent identifiers — authId:",
        authId,
        "userIdInt:",
        userIdInt,
        "userId:",
        userId,
      );

      if (!authId && !userIdInt && !userId)
        throw new Error("Not authenticated");

      // 1. Fetch event by ID only (no host filter — we verify ownership in code)
      const { data: event, error: fetchError } = await supabase
        .from(DB.events.table)
        .select("*")
        .eq(DB.events.id, eventIdInt)
        .single();

      if (fetchError || !event) {
        console.error("[Events] deleteEvent fetch error:", fetchError);
        throw new Error("Event not found");
      }

      // Verify ownership: host_id could be authId (string) or userId (integer as string)
      const hostId = String(event[DB.events.hostId]);
      console.log("[Events] deleteEvent hostId from DB:", hostId);
      const isOwner =
        (authId && hostId === authId) ||
        (userId && hostId === userId) ||
        (userIdInt != null && hostId === String(userIdInt));

      if (!isOwner) {
        console.error(
          "[Events] deleteEvent ownership mismatch — hostId:",
          hostId,
          "authId:",
          authId,
          "userId:",
          userId,
        );
        throw new Error("You are not the host of this event");
      }

      // Collect all image URLs for CDN cleanup
      const imageUrls: string[] = [];
      const coverImage = event[DB.events.coverImageUrl] || event["image"];
      if (coverImage) imageUrls.push(coverImage);
      const extraImages = parseJsonbArray(event[DB.events.images]);
      for (const img of extraImages) {
        const url = typeof img === "string" ? img : img?.url;
        if (url) imageUrls.push(url);
      }

      // 2. Delete related records (in case FK cascade is missing)
      const relatedDeletes = [
        supabase
          .from(DB.eventRsvps.table)
          .delete()
          .eq(DB.eventRsvps.eventId, eventIdInt),
        supabase
          .from(DB.eventLikes.table)
          .delete()
          .eq(DB.eventLikes.eventId, eventIdInt),
        supabase.from("event_comments").delete().eq("event_id", eventIdInt),
        supabase.from("event_reviews").delete().eq("event_id", eventIdInt),
      ];

      const results = await Promise.allSettled(relatedDeletes);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(
            `[Events] deleteEvent related delete ${i} failed:`,
            r.reason,
          );
        } else if (r.status === "fulfilled" && r.value?.error) {
          console.warn(
            `[Events] deleteEvent related delete ${i} DB error:`,
            r.value.error,
          );
        }
      });

      // 3. Delete the event itself using the actual host_id from the DB row
      const { error, count } = await supabase
        .from(DB.events.table)
        .delete()
        .eq(DB.events.id, eventIdInt)
        .eq(DB.events.hostId, hostId);

      if (error) {
        console.error("[Events] deleteEvent DB error:", error);
        throw error;
      }

      console.log("[Events] deleteEvent success, deleted count:", count);

      // 4. Clean up images from Bunny CDN (best-effort, don't block)
      if (imageUrls.length > 0) {
        const { deleteFromBunny } = await import("../bunny-storage");
        const CDN_URL =
          process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "https://dvnt.b-cdn.net";
        Promise.allSettled(
          imageUrls.map((url) => {
            const path = url.startsWith(CDN_URL)
              ? url.slice(CDN_URL.length + 1)
              : null;
            if (path) {
              console.log("[Events] Deleting CDN image:", path);
              return deleteFromBunny(path);
            }
            return Promise.resolve(false);
          }),
        ).then((cdnResults) => {
          console.log(
            "[Events] CDN cleanup results:",
            cdnResults.map((r) => r.status),
          );
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error("[Events] deleteEvent error:", error?.message || error);
      throw error;
    }
  },

  /**
   * Check if user can edit event (is host or co-organizer)
   */
  async canEditEvent(eventId: string, authId: string): Promise<boolean> {
    try {
      // Check if user is host (host_id is text/auth_id)
      const { data: event } = await supabase
        .from(DB.events.table)
        .select(DB.events.hostId)
        .eq(DB.events.id, parseInt(eventId))
        .single();

      return !!(event && event[DB.events.hostId] === authId);
    } catch (error) {
      return false;
    }
  },

  /**
   * Add co-organizer to event (only host can add)
   */
  async addCoOrganizer(_eventId: string, _coOrganizerUserId: string) {
    // event_co_organizers table not yet created in schema
    console.warn("[Events] addCoOrganizer: not yet implemented");
    throw new Error("Co-organizers not yet implemented");
  },

  /**
   * Remove co-organizer from event (only host can remove)
   */
  async removeCoOrganizer(_eventId: string, _coOrganizerUserId: string) {
    // event_co_organizers table not yet created in schema
    console.warn("[Events] removeCoOrganizer: not yet implemented");
    throw new Error("Co-organizers not yet implemented");
  },

  /**
   * Get co-organizers for an event
   */
  async getCoOrganizers(_eventId: string) {
    // event_co_organizers table not yet created in schema
    return [];
  },

  /**
   * Like an event (save it)
   */
  async likeEvent(eventId: string): Promise<boolean> {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from(DB.eventLikes.table).upsert(
        {
          [DB.eventLikes.eventId]: parseInt(eventId),
          [DB.eventLikes.userId]: userId,
        },
        { onConflict: "event_id,user_id" },
      );

      if (error) throw error;
      console.log("[Events] likeEvent:", eventId);
      return true;
    } catch (error) {
      console.error("[Events] likeEvent error:", error);
      throw error;
    }
  },

  /**
   * Unlike an event (unsave it)
   */
  async unlikeEvent(eventId: string): Promise<boolean> {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from(DB.eventLikes.table)
        .delete()
        .eq(DB.eventLikes.eventId, parseInt(eventId))
        .eq(DB.eventLikes.userId, userId);

      if (error) throw error;
      console.log("[Events] unlikeEvent:", eventId);
      return true;
    } catch (error) {
      console.error("[Events] unlikeEvent error:", error);
      throw error;
    }
  },

  /**
   * Check if current user has liked an event
   */
  async isEventLiked(eventId: string): Promise<boolean> {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) return false;

      const { data, error } = await supabase
        .from(DB.eventLikes.table)
        .select("id")
        .eq(DB.eventLikes.eventId, parseInt(eventId))
        .eq(DB.eventLikes.userId, userId)
        .maybeSingle();

      return !!data && !error;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get events liked by a user (for profile)
   */
  async getLikedEvents(userId: number, limit: number = 20) {
    try {
      const { data: likes, error } = await supabase
        .from(DB.eventLikes.table)
        .select(DB.eventLikes.eventId)
        .eq(DB.eventLikes.userId, userId)
        .order(DB.eventLikes.createdAt, { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!likes || likes.length === 0) return [];

      const eventIds = likes.map((l: any) => l[DB.eventLikes.eventId]);

      const { data: events, error: eventsError } = await supabase
        .from(DB.events.table)
        .select("*")
        .in(DB.events.id, eventIds);

      if (eventsError) throw eventsError;

      // Fetch host data
      const hostIds = [
        ...new Set(
          (events || []).map((e: any) => e[DB.events.hostId]).filter(Boolean),
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

      return (events || []).map((event: any) => {
        const host = hostsMap.get(event[DB.events.hostId]);
        return {
          id: String(event[DB.events.id]),
          title: event[DB.events.title],
          description: event[DB.events.description],
          date: event[DB.events.startDate],
          location: event[DB.events.location],
          image: resolveEventImage(event),
          price: Number(event[DB.events.price]) || 0,
          attendees: Number(event[DB.events.totalAttendees]) || 0,
          host: {
            username: host?.[DB.users.username] || "unknown",
            avatar: host?.avatar?.url || "",
          },
        };
      });
    } catch (error) {
      console.error("[Events] getLikedEvents error:", error);
      return [];
    }
  },

  /**
   * Get event comments
   */
  async getEventComments(eventId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from("event_comments")
        .select(
          `
          id,
          content,
          created_at,
          author_id,
          parent_id,
          author:author_id(
            id,
            username,
            avatar:avatar_id(url)
          )
        `,
        )
        .eq("event_id", parseInt(eventId))
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[Events] getEventComments error:", error);
        return [];
      }

      return (data || []).map((c: any) => ({
        id: String(c.id),
        content: c.content || "",
        createdAt: c.created_at,
        parentId: c.parent_id ? String(c.parent_id) : null,
        author: c.author
          ? {
              id: String(c.author.id),
              username: c.author.username,
              avatar: c.author.avatar?.url || "",
            }
          : null,
      }));
    } catch (error) {
      console.error("[Events] getEventComments error:", error);
      return [];
    }
  },

  /**
   * Add event comment
   */
  async addEventComment(eventId: string, commentContent: string) {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("event_comments")
        .insert({
          event_id: parseInt(eventId),
          author_id: userId,
          content: commentContent,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: String(data.id),
        content: data.content,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error("[Events] addEventComment error:", error);
      throw error;
    }
  },

  /**
   * Get event reviews
   */
  async getEventReviews(eventId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from("event_reviews")
        .select(
          `
          id,
          rating,
          comment,
          created_at,
          user_id,
          user:user_id(
            id,
            username,
            avatar:avatar_id(url)
          )
        `,
        )
        .eq("event_id", parseInt(eventId))
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[Events] getEventReviews error:", error);
        return [];
      }

      return (data || []).map((r: any) => ({
        id: String(r.id),
        rating: r.rating,
        comment: r.comment || "",
        createdAt: r.created_at,
        user: r.user
          ? {
              id: String(r.user.id),
              username: r.user.username,
              avatar: r.user.avatar?.url || "",
            }
          : null,
      }));
    } catch (error) {
      console.error("[Events] getEventReviews error:", error);
      return [];
    }
  },

  /**
   * Add event review
   */
  async addEventReview(eventId: string, rating: number, content: string) {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      // Upsert: one review per user per event
      const { data, error } = await supabase
        .from("event_reviews")
        .upsert(
          {
            event_id: parseInt(eventId),
            user_id: userId,
            rating,
            comment: content || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "event_id,user_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return {
        id: String(data.id),
        rating: data.rating,
        comment: data.comment,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error("[Events] addEventReview error:", error);
      throw error;
    }
  },
};
