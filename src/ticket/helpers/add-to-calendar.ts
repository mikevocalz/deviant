/**
 * addTicketToCalendar — Add event to device calendar via expo-calendar
 * Handles permissions, duplicate detection, and graceful fallbacks.
 */

import * as Calendar from "expo-calendar";
import { Platform, Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Ticket } from "@/lib/stores/ticket-store";

const CALENDAR_EVENTS_KEY = "@deviant/calendar_events";

/** Persist which tickets have been added to calendar */
async function getAddedEvents(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_EVENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function markEventAdded(ticketId: string, calendarEventId: string) {
  const map = await getAddedEvents();
  map[ticketId] = calendarEventId;
  await AsyncStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(map));
}

async function isAlreadyAdded(ticketId: string): Promise<boolean> {
  const map = await getAddedEvents();
  return Boolean(map[ticketId]);
}

/** Get the default writable calendar */
async function getDefaultCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );

  // Prefer the default calendar
  const defaultCal = calendars.find(
    (c) =>
      c.allowsModifications &&
      (c.source?.name === "Default" ||
        c.source?.name === "iCloud" ||
        c.isPrimary),
  );

  if (defaultCal) return defaultCal.id;

  // Fallback: first writable calendar
  const writable = calendars.find((c) => c.allowsModifications);
  if (writable) return writable.id;

  // Android: create a local calendar
  if (Platform.OS === "android") {
    const newCalId = await Calendar.createCalendarAsync({
      title: "Deviant Events",
      color: "#fbbf24",
      entityType: Calendar.EntityTypes.EVENT,
      source: {
        isLocalAccount: true,
        name: "Deviant",
        type: Calendar.SourceType?.LOCAL ?? ("LOCAL" as any),
      },
      name: "deviant-events",
      ownerAccount: "deviant",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return newCalId;
  }

  return null;
}

function openSettings() {
  Alert.alert(
    "Calendar Access Required",
    "Please enable calendar access in Settings to add this event.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ],
  );
}

export interface AddToCalendarResult {
  success: boolean;
  alreadyAdded?: boolean;
  error?: string;
}

/**
 * Add a ticket's event to the device calendar.
 * Returns { success, alreadyAdded, error }.
 */
export async function addTicketToCalendar(
  ticket: Ticket,
): Promise<AddToCalendarResult> {
  try {
    // 1. Check duplicate
    if (await isAlreadyAdded(ticket.id)) {
      return { success: true, alreadyAdded: true };
    }

    // 2. Request permissions
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      openSettings();
      return { success: false, error: "permission_denied" };
    }

    // 3. Get calendar
    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      return { success: false, error: "no_calendar" };
    }

    // 4. Build event
    const startDate = ticket.eventDate
      ? new Date(ticket.eventDate)
      : new Date();
    const endDate = ticket.eventEndDate
      ? new Date(ticket.eventEndDate)
      : new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // default 3h

    const deepLink = `dvnt://ticket/${ticket.eventId}`;

    const notes = [
      ticket.tierName || ticket.tier?.toUpperCase() || "General Admission",
      `Ticket ID: ${ticket.id}`,
      "",
      `View ticket: ${deepLink}`,
    ]
      .filter(Boolean)
      .join("\n");

    const calendarEventId = await Calendar.createEventAsync(calendarId, {
      title: ticket.eventTitle || "Event",
      startDate,
      endDate,
      location: ticket.eventLocation || undefined,
      notes,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: [{ relativeOffset: -60 }], // 1 hour before
    });

    // 5. Persist
    await markEventAdded(ticket.id, calendarEventId);

    return { success: true };
  } catch (err: any) {
    console.error("[addTicketToCalendar] Error:", err);
    return { success: false, error: err?.message || "unknown" };
  }
}
