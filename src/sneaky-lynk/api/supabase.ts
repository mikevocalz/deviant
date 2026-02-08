/**
 * Sneaky Lynk API Client
 * Calls Supabase Edge Functions for room management
 */

import { supabase } from "@/lib/supabase/client";
import { getBetterAuthToken } from "@/lib/auth/identity";
import type { CreateRoomParams, JoinRoomResponse, SneakyRoom } from "../types";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "validation_error"
  | "internal_error";

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: ErrorCode; message: string };
}

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const token = await getBetterAuthToken();
  if (!token) {
    return {
      ok: false,
      error: { code: "unauthorized", message: "Not authenticated" },
    };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    console.error(`[SneakyLynk] ${functionName} error:`, error);
    return {
      ok: false,
      error: { code: "internal_error", message: "Network error" },
    };
  }
}

export const sneakyLynkApi = {
  /**
   * Create a new Sneaky Lynk room
   * Uses existing video_create_room Edge Function
   */
  async createRoom(
    params: CreateRoomParams,
  ): Promise<ApiResponse<{ room: SneakyRoom }>> {
    return callEdgeFunction("video_create_room", {
      title: params.title,
      isPublic: params.isPublic ?? true,
      maxParticipants: 50,
    });
  },

  /**
   * Join a room and get Fishjam token
   * Uses existing video_join_room Edge Function
   */
  async joinRoom(roomId: string): Promise<ApiResponse<JoinRoomResponse>> {
    return callEdgeFunction("video_join_room", { roomId });
  },

  /**
   * Refresh Fishjam token
   * Uses existing video_refresh_token Edge Function
   */
  async refreshToken(
    roomId: string,
  ): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
    return callEdgeFunction("video_refresh_token", { roomId });
  },

  /**
   * Kick a user from the room (host/moderator only)
   * Uses existing video_kick_user Edge Function
   */
  async kickUser(
    roomId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<ApiResponse<void>> {
    return callEdgeFunction("video_kick_user", {
      roomId,
      targetUserId,
      reason,
    });
  },

  /**
   * Ban a user from the room (host/moderator only)
   * Uses existing video_ban_user Edge Function
   */
  async banUser(
    roomId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<ApiResponse<void>> {
    return callEdgeFunction("video_ban_user", { roomId, targetUserId, reason });
  },

  /**
   * End the room (host only)
   * Uses existing video_end_room Edge Function
   */
  async endRoom(roomId: string): Promise<ApiResponse<void>> {
    return callEdgeFunction("video_end_room", { roomId });
  },

  /**
   * Raise/lower hand
   * TODO: Add to video Edge Functions if needed
   */
  async toggleHand(
    roomId: string,
    raised: boolean,
  ): Promise<ApiResponse<void>> {
    // For now, just log - hand raise can be handled client-side or added to video functions
    console.log(`[SneakyLynk] Toggle hand: ${raised} in room ${roomId}`);
    return { ok: true };
  },

  /**
   * Get recent rooms list from video_rooms table
   * Includes both live (open) and recently ended rooms (last 24h)
   * so ALL users can see active and ended Sneaky Lynks.
   */
  async getLiveRooms(): Promise<SneakyRoom[]> {
    try {
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase
        .from("video_rooms")
        .select(
          `
          *,
          creator:created_by(id, auth_id, username, first_name, avatar:avatar_id(url), verified)
        `,
        )
        .or(
          `status.eq.open,and(status.eq.ended,ended_at.gte.${twentyFourHoursAgo})`,
        )
        .order("status", { ascending: true }) // "open" before "ended"
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[SneakyLynk] getLiveRooms error:", error.message);
        return [];
      }

      return (data || []).map((r: any) => ({
        id: String(r.id),
        createdBy: r.created_by || "",
        title: r.title || "Untitled Lynk",
        topic: r.topic || "",
        description: r.description || "",
        isLive: r.status === "open",
        hasVideo: r.has_video ?? false,
        isPublic: r.is_public ?? true,
        status: r.status as "open" | "ended",
        createdAt: r.created_at,
        endedAt: r.ended_at || undefined,
        host: {
          id: String(r.creator?.id || ""),
          username: r.creator?.username || "unknown",
          displayName:
            r.creator?.first_name || r.creator?.username || "unknown",
          avatar: r.creator?.avatar?.url || "",
          isVerified: r.creator?.verified || false,
        },
        speakers: [],
        listeners: 0,
        fishjamRoomId: r.fishjam_room_id || undefined,
      }));
    } catch (error) {
      console.error("[SneakyLynk] getLiveRooms error:", error);
      return [];
    }
  },

  /**
   * Get room by ID
   */
  async getRoomById(roomId: string): Promise<SneakyRoom | null> {
    try {
      const { data, error } = await supabase
        .from("video_rooms")
        .select(
          `
          *,
          creator:created_by(id, auth_id, username, first_name, avatar:avatar_id(url), verified)
        `,
        )
        .eq("id", roomId)
        .single();

      if (error || !data) return null;

      return {
        id: String(data.id),
        createdBy: data.created_by || "",
        title: data.title || "Untitled Lynk",
        topic: data.topic || "",
        description: data.description || "",
        isLive: data.status === "open",
        hasVideo: data.has_video ?? false,
        isPublic: data.is_public ?? true,
        status: data.status as "open" | "ended",
        createdAt: data.created_at,
        endedAt: data.ended_at || undefined,
        host: {
          id: String(data.creator?.id || ""),
          username: data.creator?.username || "unknown",
          displayName:
            data.creator?.first_name || data.creator?.username || "unknown",
          avatar: data.creator?.avatar?.url || "",
          isVerified: data.creator?.verified || false,
        },
        speakers: [],
        listeners: 0,
        fishjamRoomId: data.fishjam_room_id || undefined,
      };
    } catch (error) {
      console.error("[SneakyLynk] getRoomById error:", error);
      return null;
    }
  },
};
