/**
 * Safe Entity Normalization
 *
 * Prevents crashes when TanStack Query updates data to null/undefined during render.
 * Creates guaranteed non-null objects with sensible defaults.
 *
 * Usage:
 *   const safePost = useMemo(() => normalizePost(post, postId), [post, postId]);
 *   const safeProfile = useMemo(() => normalizeProfile(profile, username), [profile, username]);
 */

import type { Post } from "@/lib/types";

// ── Post Normalization ───────────────────────────────────────
export function normalizePost(
  post: Post | null | undefined,
  fallbackId?: string,
): Post {
  if (!post) {
    return {
      id: fallbackId || "",
      author: {
        id: "",
        username: "unknown",
        avatar: "",
        verified: false,
        name: "Unknown User",
      },
      media: [],
      kind: "media",
      textTheme: "graphite",
      caption: "",
      likes: 0,
      viewerHasLiked: false,
      comments: 0,
      timeAgo: "Just now",
      location: undefined,
      isNSFW: false,
      thumbnail: undefined,
      type: "image",
      hasMultipleImages: false,
    };
  }
  return post;
}

// ── Profile Normalization ────────────────────────────────────
export interface SafeProfile {
  id: string;
  username: string;
  avatar: string;
  name: string;
  verified: boolean;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;
  isCurrentUser?: boolean;
}

export function normalizeProfile(
  profile: any | null | undefined,
  fallbackUsername?: string,
): SafeProfile {
  if (!profile) {
    return {
      id: "",
      username: fallbackUsername || "unknown",
      avatar: "",
      name: fallbackUsername || "Unknown User",
      verified: false,
      bio: "",
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      isFollowing: false,
      isCurrentUser: false,
    };
  }
  return {
    id: profile.id || "",
    username: profile.username || fallbackUsername || "unknown",
    avatar: profile.avatar || "",
    name:
      profile.name || profile.username || fallbackUsername || "Unknown User",
    verified: profile.verified || false,
    bio: profile.bio || "",
    followersCount: profile.followersCount || 0,
    followingCount: profile.followingCount || 0,
    postsCount: profile.postsCount || 0,
    isFollowing: profile.isFollowing || false,
    isCurrentUser: profile.isCurrentUser || false,
  };
}

// ── Comment Normalization ───────────────────────────────────
export interface SafeComment {
  id: string;
  postId: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  hasLiked: boolean;
  replies?: SafeComment[];
}

export function normalizeComment(
  comment: any | null | undefined,
): SafeComment | null {
  if (!comment || !comment.id) return null;
  return {
    id: comment.id || "",
    postId: comment.postId || "",
    username: comment.username || "unknown",
    avatar: comment.avatar || "",
    text: comment.text || "",
    timeAgo: comment.timeAgo || "Just now",
    likes: comment.likes || 0,
    hasLiked: comment.hasLiked || false,
    replies: Array.isArray(comment.replies)
      ? (comment.replies.map(normalizeComment).filter(Boolean) as SafeComment[])
      : [],
  };
}

// ── Event Normalization ─────────────────────────────────────
export interface SafeEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  fullDate?: string;
  endDate?: string;
  location?: string;
  image: string;
  price: number;
  attendees: number;
  totalAttendees?: number;
  images?: { type: string; url: string }[];
  youtubeVideoUrl?: string | null;
  maxAttendees?: number;
  host: {
    id?: string;
    username: string;
    avatar: string;
    name?: string;
    verified?: boolean;
  };
  coOrganizer?: any;
  month?: string;
  time?: string;
  category?: string;
  likes?: number;
  isLiked?: boolean;
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
  isPromoted?: boolean;
  // Additional properties from the actual event data
  ticketTiers?: any[];
  attendeeAvatars?: any[];
  topReviews?: any[];
  topComments?: any[];
  userRsvpStatus?: string;
  averageRating?: number;
  // Event detail properties
  lineup?: string[];
  dressCode?: string;
  doorPolicy?: string;
  entryWindow?: string;
  perks?: string[];
  venues?: string[];
}

export function normalizeEvent(event: any | null | undefined): SafeEvent {
  if (!event || !event.id) {
    return {
      id: "",
      title: "Untitled Event",
      description: "",
      date: "",
      image: "",
      price: 0,
      attendees: 0,
      host: { username: "", avatar: "" },
    };
  }
  return {
    id: event.id || "",
    title: event.title || "Untitled Event",
    description: event.description || "",
    date: event.date || "",
    fullDate: event.fullDate,
    endDate: event.endDate,
    location: event.location,
    image: event.image || "",
    price: event.price || 0,
    attendees: event.attendees || [],
    totalAttendees: event.totalAttendees,
    images: event.images || [],
    youtubeVideoUrl: event.youtubeVideoUrl,
    maxAttendees: event.maxAttendees,
    host: event.host || { username: "", avatar: "" },
    coOrganizer: event.coOrganizer,
    month: event.month,
    time: event.time,
    category: event.category,
    likes: event.likes || 0,
    isLiked: event.isLiked || false,
    locationLat: event.locationLat,
    locationLng: event.locationLng,
    locationName: event.locationName,
    isPromoted: event.isPromoted || false,
    ticketTiers: event.ticketTiers || [],
    attendeeAvatars: event.attendeeAvatars || [],
    topReviews: event.topReviews || [],
    topComments: event.topComments || [],
    userRsvpStatus: event.userRsvpStatus,
    averageRating: event.averageRating,
    lineup: event.lineup || [],
    dressCode: event.dressCode,
    doorPolicy: event.doorPolicy,
    entryWindow: event.entryWindow,
    perks: event.perks || [],
    venues: event.venues || [],
  };
}

// ── Array Normalization ───────────────────────────────────────
export function normalizeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

// ── String Normalization ─────────────────────────────────────
export function normalizeString(str: string | null | undefined): string {
  return str || "";
}

// ── Number Normalization ─────────────────────────────────────
export function normalizeNumber(num: number | null | undefined): number {
  return typeof num === "number" && !isNaN(num) ? num : 0;
}

// ── Boolean Normalization ────────────────────────────────────
export function normalizeBoolean(bool: boolean | null | undefined): boolean {
  return Boolean(bool);
}
