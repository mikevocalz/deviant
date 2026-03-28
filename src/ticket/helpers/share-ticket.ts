/**
 * shareTicket — Share event ticket info via expo-sharing
 * Never shares QR payloads or sensitive wallet URLs.
 * Respects transferable flag.
 */

import * as Sharing from "expo-sharing";
import { Share, Platform } from "react-native";
import type { Ticket } from "@/lib/stores/ticket-store";

export interface ShareTicketResult {
  success: boolean;
  error?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Share ticket event info.
 * - Non-transferable tickets share only event info (no deep link to ticket).
 * - Transferable tickets include a deep link.
 * - QR tokens are NEVER shared.
 */
export async function shareTicket(
  ticket: Ticket,
): Promise<ShareTicketResult> {
  try {
    const title = ticket.eventTitle || "Event";
    const tierLabel = ticket.tierName || ticket.tier?.toUpperCase() || "";
    const deepLink = `dvnt://ticket/${ticket.eventId}`;

    const lines: string[] = [title];

    if (ticket.eventLocation) {
      lines.push(`📍 ${ticket.eventLocation}`);
    }
    if (ticket.eventDate) {
      lines.push(`🗓 ${formatDate(ticket.eventDate)} at ${formatTime(ticket.eventDate)}`);
    }
    if (tierLabel) {
      lines.push(`🎟 ${tierLabel}`);
    }

    // Only include deep link for transferable tickets
    if (ticket.transferable) {
      lines.push("");
      lines.push(`View ticket: ${deepLink}`);
    }

    const message = lines.join("\n");

    // Use expo-sharing if available, fallback to RN Share
    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      // expo-sharing requires a file URI for shareAsync,
      // so we use the RN Share API for text-only sharing
      await Share.share(
        {
          message,
          title: `${title} Ticket`,
        },
        {
          dialogTitle: "Share Event Ticket",
        },
      );
    } else {
      // Fallback
      await Share.share({
        message,
        title: `${title} Ticket`,
      });
    }

    return { success: true };
  } catch (err: any) {
    // User cancelled is not an error
    if (err?.message?.includes("dismiss") || err?.code === "ERR_SHARING_CANCELLED") {
      return { success: true };
    }
    console.error("[shareTicket] Error:", err);
    return { success: false, error: err?.message || "unknown" };
  }
}
