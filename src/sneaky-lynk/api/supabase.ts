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
      let message = error.message || "Edge function error";
      const response = (error as any)?.context;

      if (response) {
        try {
          const payload = await response.clone().json();
          console.error(
            `[SneakyLynk] ${functionName} http error payload:`,
            payload,
          );
          message =
            payload?.error?.message ||
            payload?.message ||
            `${response.status} ${response.statusText}` ||
            message;
        } catch {
          try {
            const text = await response.clone().text();
            console.error(
              `[SneakyLynk] ${functionName} http error text:`,
              text,
            );
            message =
              text || `${response.status} ${response.statusText}` || message;
          } catch {
            console.error(
              `[SneakyLynk] ${functionName} invoke error without readable body:`,
              error,
            );
          }
        }
      } else {
        console.error(`[SneakyLynk] ${functionName} invoke error:`, error);
      }

      return {
        ok: false,
        error: {
          code: "internal_error",
          message,
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
  async joinRoom(
    roomId: string,
    anonymous = false,
  ): Promise<ApiResponse<JoinRoomResponse>> {
    return callEdgeFunction("video_join_room", { roomId, anonymous });
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
   * Leave a room (any participant)
   * Marks member as "left", decrements participant_count, auto-ends if empty
   */
  async leaveRoom(roomId: string): Promise<
    ApiResponse<{
      left: boolean;
      roomEnded: boolean;
      remainingParticipants: number;
    }>
  > {
    return callEdgeFunction("video_leave_room", { roomId });
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
   */
  async toggleHand(
    roomId: string,
    raised: boolean,
  ): Promise<ApiResponse<void>> {
    return callEdgeFunction("video_toggle_hand", { roomId, raised });
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
        .eq("is_public", true)
        .or(
          `status.eq.open,and(status.eq.ended,ended_at.gte.${twentyFourHoursAgo})`,
        )
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

      // For open rooms, cross-check actual active member counts
      // to prevent stale participant_count from showing dead rooms as LIVE.
      // Only count members who joined within the last 12 hours — older
      // "active" rows are stale (user disconnected before the leaveRoom
      // fix existed, or app crashed without calling leave).
      const openRoomIds = (data || [])
        .filter((r: any) => r.status === "open")
        .map((r: any) => r.id);

      const twelveHoursAgo = new Date(
        Date.now() - 12 * 60 * 60 * 1000,
      ).toISOString();

      let activeCounts: Record<number, number> = {};
      if (openRoomIds.length > 0) {
        const { data: members } = await supabase
          .from("video_room_members")
          .select("room_id")
          .in("room_id", openRoomIds)
          .eq("status", "active")
          .gte("joined_at", twelveHoursAgo);
        if (members) {
          for (const m of members) {
            activeCounts[m.room_id] = (activeCounts[m.room_id] || 0) + 1;
          }
        }
      }

      return (data || [])
        .filter((r: any) => r.is_public === true) // SAFETY NET: Exclude private rooms
        .map((r: any) => {
          const creator = creatorsMap[r.created_by] || null;
          // Use real active member count for open rooms, not stale participant_count
          const realCount =
            r.status === "open"
              ? (activeCounts[r.id] ?? 0)
              : r.participant_count || 0;
          return {
            id: r.uuid || String(r.id),
            createdBy: r.created_by || "",
            title: r.title || "Untitled Lynk",
            topic: r.topic || "",
            description: r.description || "",
            sweetSpicyMode: r.sweet_spicy_mode || "sweet",
            isLive: r.status === "open" && realCount > 0,
            hasVideo: r.has_video ?? false,
            isPublic: r.is_public ?? true,
            status: r.status as "open" | "ended",
            createdAt: r.created_at,
            endedAt: r.ended_at || undefined,
            host: {
              id: String(creator?.id || ""),
              username: creator?.username || "unknown",
              displayName:
                creator?.first_name || creator?.username || "unknown",
              avatar: (creator?.avatar as any)?.url || "",
              isVerified: creator?.verified || false,
            },
            speakers: [],
            listeners: realCount,
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
        sweetSpicyMode: data.sweet_spicy_mode || "sweet",
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

  async setRoomMode(
    roomId: string,
    mode: "sweet" | "spicy",
  ): Promise<ApiResponse<{ roomId: string; mode: "sweet" | "spicy" }>> {
    return callEdgeFunction("video_set_room_mode", { roomId, mode });
  },
};
