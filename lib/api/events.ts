/**
 * Events API - fetches real event data from Payload CMS
 */

import { Platform } from "react-native";

// Get JWT token from storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync("dvnt_auth_token");
  } catch {
    return null;
  }
}

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
  // Fetch all events (uses custom endpoint)
  async getEvents(category?: string): Promise<Event[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();
      
      const categoryParam = category && category !== "all" ? `&category=${category}` : "";
      const response = await fetch(
        `${apiUrl}/api/events?limit=50&filter=all${categoryParam}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[eventsApi] getEvents failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformEvent);
    } catch (error) {
      console.error("[eventsApi] getEvents error:", error);
      return [];
    }
  },

  // Fetch upcoming events (uses custom endpoint)
  async getUpcomingEvents(): Promise<Event[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events?limit=50&filter=upcoming`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[eventsApi] getUpcomingEvents failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformEvent);
    } catch (error) {
      console.error("[eventsApi] getUpcomingEvents error:", error);
      return [];
    }
  },

  // Fetch past events (uses custom endpoint)
  async getPastEvents(): Promise<Event[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events?limit=50&filter=past`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[eventsApi] getPastEvents failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformEvent);
    } catch (error) {
      console.error("[eventsApi] getPastEvents error:", error);
      return [];
    }
  },

  // Fetch single event by ID (uses custom endpoint)
  async getEventById(id: string): Promise<Event | null> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return null;

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events/${id}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[eventsApi] getEventById failed:", response.status);
        return null;
      }

      const doc = await response.json();
      return transformEvent(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[eventsApi] getEventById error:", error);
      return null;
    }
  },

  // Create a new event (NOTE: May need custom endpoint for this)
  async createEvent(data: Partial<Event>): Promise<Event> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
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
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.status}`);
      }

      const doc = await response.json();
      return transformEvent(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[eventsApi] createEvent error:", error);
      throw error;
    }
  },
};
