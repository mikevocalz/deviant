/**
 * Sneaky Lynk API Client
 * Calls Supabase Edge Functions for room management
 */

import { supabase } from "@/lib/supabase/client";
import { requireBetterAuthToken } from "@/lib/auth/identity";
import type { CreateRoomParams, JoinRoomResponse, SneakyRoom } from "../types";

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
  try {
    const token = await requireBetterAuthToken();

    const { data, error } = await supabase.functions.invoke<ApiResponse<T>>(
      functionName,
      {
        body,
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (error) {
      console.error(`[SneakyLynk] ${functionName} invoke error:`, error);
      return {
        ok: false,
        error: {
          code: "internal_error",
          message: error.message || "Edge function error",
        },
      };
    }

    return data as ApiResponse<T>;
  } catch (err: any) {
    console.error(`[SneakyLynk] ${functionName} error:`, err);
    return {
      ok: false,
      error: {
        code: "internal_error",
        message: err.message || "Network error",
      },
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
      topic: params.topic || "",
      description: params.description || "",
      hasVideo: params.hasVideo ?? false,
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

      // No FK on created_by → fetch rooms first, then batch-lookup creators
      const { data, error } = await supabase
        .from("video_rooms")
        .select("*")
        .or(
          `status.eq.open,and(status.eq.ended,ended_at.gte.${twentyFourHoursAgo})`,
        )
        .not("title", "in", '("Video Call","Audio Call")')
        .order("status", { ascending: false }) // "open" (o) before "ended" (e)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[SneakyLynk] getLiveRooms error:", error.message);
        return [];
      }

      // Batch-lookup creators by auth_id
      const creatorIds = [
        ...new Set((data || []).map((r: any) => r.created_by).filter(Boolean)),
      ];
      let creatorsMap: Record<string, any> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("users")
          .select(
            "id, auth_id, username, first_name, avatar:avatar_id(url), verified",
          )
          .in("auth_id", creatorIds);
        if (creators) {
          for (const c of creators) {
            creatorsMap[c.auth_id] = c;
          }
        }
      }

      return (data || []).map((r: any) => {
        const creator = creatorsMap[r.created_by] || null;
        return {
          id: r.uuid || String(r.id),
          createdBy: r.created_by || "",
          title: r.title || "Untitled Lynk",
          topic: r.topic || "",
          description: r.description || "",
          isLive:
            r.status === "open" &&
            (r.participant_count || 0) > 0 &&
            // Room timer is 16 min — anything older than 20 min is stale
            Date.now() - new Date(r.created_at).getTime() < 20 * 60 * 1000,
          hasVideo: r.has_video ?? false,
          isPublic: r.is_public ?? true,
          status: r.status as "open" | "ended",
          createdAt: r.created_at,
          endedAt: r.ended_at || undefined,
          host: {
            id: String(creator?.id || ""),
            username: creator?.username || "unknown",
            displayName: creator?.first_name || creator?.username || "unknown",
            avatar: (creator?.avatar as any)?.url || "",
            isVerified: creator?.verified || false,
          },
          speakers: [],
          listeners: r.participant_count || 0,
          maxParticipants: r.max_participants || 50,
          fishjamRoomId: r.fishjam_room_id || undefined,
        };
      });
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
      // Try uuid first (new rooms), fall back to integer id (legacy)
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          roomId,
        );
      const lookupColumn = isUuid ? "uuid" : "id";
      const { data, error } = await supabase
        .from("video_rooms")
        .select("*")
        .eq(lookupColumn, roomId)
        .single();

      if (error || !data) return null;

      // Lookup creator by auth_id (no FK on created_by)
      let creator: any = null;
      if (data.created_by) {
        const { data: creatorData } = await supabase
          .from("users")
          .select(
            "id, auth_id, username, first_name, avatar:avatar_id(url), verified",
          )
          .eq("auth_id", data.created_by)
          .single();
        creator = creatorData;
      }

      return {
        id: data.uuid || String(data.id),
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
          id: String(creator?.id || ""),
          username: creator?.username || "unknown",
          displayName: creator?.first_name || creator?.username || "unknown",
          avatar: (creator?.avatar as any)?.url || "",
          isVerified: creator?.verified || false,
        },
        speakers: [],
        listeners: data.participant_count || 0,
        fishjamRoomId: data.fishjam_room_id || undefined,
      };
    } catch (error) {
      console.error("[SneakyLynk] getRoomById error:", error);
      return null;
    }
  },
};
