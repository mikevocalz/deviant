/**
 * Sneaky Lynk API Client
 * Calls Supabase Edge Functions for room management
 */

import { supabase } from "@/lib/supabase/client";
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

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
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
   * Get live rooms list
   * TODO: Replace with real Supabase query
   */
  async getLiveRooms(topic?: string): Promise<SneakyRoom[]> {
    // TODO: Implement real query
    // const { data, error } = await supabase
    //   .from("sneaky_rooms")
    //   .select(`
    //     *,
    //     host:created_by(id, username, avatar, is_verified),
    //     members:sneaky_room_members(
    //       user:user_id(id, username, avatar, is_verified),
    //       role
    //     )
    //   `)
    //   .eq("is_live", true)
    //   .eq("status", "open")
    //   .order("created_at", { ascending: false });

    console.log("[SneakyLynk] getLiveRooms - using mock data");
    return [];
  },

  /**
   * Get room by ID
   * TODO: Replace with real Supabase query
   */
  async getRoomById(roomId: string): Promise<SneakyRoom | null> {
    // TODO: Implement real query
    console.log("[SneakyLynk] getRoomById - using mock data", roomId);
    return null;
  },
};
