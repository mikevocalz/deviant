/**
 * ShareLink Utility
 * Generates canonical HTTPS share URLs for any entity.
 * NEVER shares dvnt:// scheme externally — always HTTPS.
 */

import { Share, Platform } from "react-native";
import * as Haptics from "expo-haptics";

const PRODUCTION_DOMAIN = "https://dvntlive.app";

// ── URL Builders ─────────────────────────────────────────────────────

export const shareUrls = {
  profile: (username: string) => `${PRODUCTION_DOMAIN}/u/${username}`,
  post: (postId: string) => `${PRODUCTION_DOMAIN}/p/${postId}`,
  event: (eventId: string) => `${PRODUCTION_DOMAIN}/e/${eventId}`,
  story: (storyId: string) => `${PRODUCTION_DOMAIN}/story/${storyId}`,
  ticket: (ticketId: string) => `${PRODUCTION_DOMAIN}/ticket/${ticketId}`,
  chat: (chatId: string) => `${PRODUCTION_DOMAIN}/chat/${chatId}`,
  room: (roomId: string) => `${PRODUCTION_DOMAIN}/room/${roomId}`,
  comments: (postId: string) => `${PRODUCTION_DOMAIN}/comments/${postId}`,
};

// ── Share Functions ──────────────────────────────────────────────────

export interface ShareOptions {
  title?: string;
  message?: string;
}

/**
 * Share a profile link via the native share sheet.
 * Instagram-style: "Check out @username on DVNT"
 */
export async function shareProfile(
  username: string,
  displayName?: string,
): Promise<boolean> {
  const url = shareUrls.profile(username);
  const name = displayName || username;
  return shareUrl(url, {
    title: `${name} on DVNT`,
    message: `Check out @${username} on DVNT\n${url}`,
  });
}

/**
 * Share a post link via the native share sheet.
 */
export async function sharePost(
  postId: string,
  caption?: string,
): Promise<boolean> {
  const url = shareUrls.post(postId);
  return shareUrl(url, {
    title: "Post on DVNT",
    message: caption ? `${caption}\n${url}` : url,
  });
}

/**
 * Share an event link via the native share sheet.
 */
export async function shareEvent(
  eventId: string,
  eventName?: string,
): Promise<boolean> {
  const url = shareUrls.event(eventId);
  return shareUrl(url, {
    title: eventName || "Event on DVNT",
    message: eventName ? `${eventName}\n${url}` : url,
  });
}

/**
 * Share a story link via the native share sheet.
 */
export async function shareStory(storyId: string): Promise<boolean> {
  const url = shareUrls.story(storyId);
  return shareUrl(url, {
    title: "Story on DVNT",
    message: url,
  });
}

/**
 * Core share function — opens the native share sheet.
 * Returns true if shared successfully, false if dismissed/errored.
 */
export async function shareUrl(
  url: string,
  options?: ShareOptions,
): Promise<boolean> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await Share.share(
      Platform.OS === "ios"
        ? {
            url,
            message: options?.message,
          }
        : {
            message: options?.message || url,
          },
      {
        dialogTitle: options?.title || "Share via DVNT",
        subject: options?.title || "DVNT",
      },
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("[ShareLink] Share failed:", error);
    return false;
  }
}

/**
 * Copy a share URL to clipboard.
 * Uses react-native's deprecated but universally available Clipboard.
 */
export function copyShareUrl(url: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Clipboard: RNClipboard } = require("react-native");
    if (RNClipboard?.setString) {
      RNClipboard.setString(url);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.error("[ShareLink] Copy failed:", error);
  }
}
