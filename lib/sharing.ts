import { Share, Platform } from "react-native";

const APP_URL = "https://dvntlive.app";

interface ShareOptions {
  title: string;
  message: string;
  url?: string;
}

async function shareNative({ title, message, url }: ShareOptions) {
  try {
    const content: { title: string; message: string; url?: string } = {
      title,
      message: url ? `${message}\n${url}` : message,
    };
    if (Platform.OS === "ios" && url) {
      content.url = url;
    }
    await Share.share(content);
  } catch (err: any) {
    if (err?.message !== "User did not share") {
      console.error("[Share] Error:", err);
    }
  }
}

export const dvntShare = {
  post(postId: number, title?: string) {
    return shareNative({
      title: title || "Check out this post on DVNT",
      message: "Check out this post on DVNT",
      url: `${APP_URL}/post/${postId}`,
    });
  },

  event(eventId: number, eventTitle?: string) {
    return shareNative({
      title: eventTitle || "Check out this event on DVNT",
      message: eventTitle
        ? `${eventTitle} — on DVNT`
        : "Check out this event on DVNT",
      url: `${APP_URL}/event/${eventId}`,
    });
  },

  profile(username: string) {
    return shareNative({
      title: `@${username} on DVNT`,
      message: `Check out @${username} on DVNT`,
      url: `${APP_URL}/@${username}`,
    });
  },

  story(storyId: number, authorUsername?: string) {
    return shareNative({
      title: authorUsername
        ? `@${authorUsername}'s story on DVNT`
        : "Check out this story on DVNT",
      message: "Check out this story on DVNT",
      url: `${APP_URL}/story/${storyId}`,
    });
  },

  custom(title: string, message: string, url?: string) {
    return shareNative({ title, message, url });
  },
};
