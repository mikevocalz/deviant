/**
 * Events API - fetches real event data from Payload CMS
 */

import { events as eventsApi } from "@/lib/api-client";

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  month: string;
  fullDate: Date;
  time: string;
  location: string;
  price: number;
  image: string;
  category: string;
  attendees: Array<{
    id?: string;
    name: string;
    image?: string;
    initials?: string;
  }>;
  totalAttendees: number;
  likes: number;
}

// Transform API response to match Event type
function transformEvent(doc: Record<string, unknown>): Event {
  const eventDate = new Date((doc.date as string) || (doc.createdAt as string));

  return {
    id: doc.id as string,
    title: (doc.title as string) || "Untitled Event",
    description: doc.description as string,
    date: eventDate.getDate().toString().padStart(2, "0"),
    month: eventDate.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    fullDate: eventDate,
    time: (doc.time as string) || formatTime(eventDate),
    location: (doc.location as string) || "TBA",
    price: (doc.price as number) || 0,
    image:
      (doc.image as string) ||
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1000&fit=crop",
    category: (doc.category as string) || "Event",
    attendees: ((doc.attendees as Array<Record<string, unknown>>) || []).map(
      (a) => ({
        id: a.id as string,
        name: (a.name as string) || "Guest",
        image: a.image as string,
        initials: a.initials as string,
      }),
    ),
    totalAttendees: (doc.totalAttendees as number) || 0,
    likes: (doc.likes as number) || 0,
  };
}

function formatTime(date: Date): string {
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const eventsApiClient = {
  // Fetch all events
  async getEvents(category?: string): Promise<Event[]> {
    try {
      // depth: 2 to populate attendee relationships
      const response = await eventsApi.find({
        limit: 50,
        sort: "date",
        category: category === "all" ? undefined : category,
        depth: 2,
      });
      return response.docs.map(transformEvent);
    } catch (error) {
      console.error("[eventsApi] getEvents error:", error);
      return [];
    }
  },

  // Fetch upcoming events
  async getUpcomingEvents(): Promise<Event[]> {
    try {
      // depth: 2 to populate attendee relationships
      const response = await eventsApi.find({
        limit: 50,
        sort: "date",
        depth: 2,
        where: {
          date: { greater_than: new Date().toISOString() },
        },
      });
      return response.docs.map(transformEvent);
    } catch (error) {
      console.error("[eventsApi] getUpcomingEvents error:", error);
      return [];
    }
  },

  // Fetch past events
  async getPastEvents(): Promise<Event[]> {
    try {
      // depth: 2 to populate attendee relationships
      const response = await eventsApi.find({
        limit: 50,
        sort: "-date",
        depth: 2,
        where: {
          date: { less_than: new Date().toISOString() },
        },
      });
      return response.docs.map(transformEvent);
    } catch (error) {
      console.error("[eventsApi] getPastEvents error:", error);
      return [];
    }
  },

  // Fetch single event by ID
  async getEventById(id: string): Promise<Event | null> {
    try {
      const doc = await eventsApi.findByID(id, 2);
      return transformEvent(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[eventsApi] getEventById error:", error);
      return null;
    }
  },

  // Create a new event
  async createEvent(data: Partial<Event>): Promise<Event> {
    try {
      const doc = await eventsApi.create({
        title: data.title,
        description: data.description,
        date: data.fullDate?.toISOString(),
        time: data.time,
        location: data.location,
        price: data.price,
        image: data.image,
        category: data.category,
        maxAttendees: (data as any).maxAttendees,
        likes: 0,
        totalAttendees: 0,
      });
      return transformEvent(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[eventsApi] createEvent error:", error);
      throw error;
    }
  },
};
