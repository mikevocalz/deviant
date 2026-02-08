/**
 * Video Chat API Client
 * Calls Supabase Edge Functions for video room operations
 */

import { supabase } from "@/lib/supabase/client";
import { requireBetterAuthToken } from "@/lib/auth/identity";
import type {
  VideoRoom,
  JoinRoomResponse,
  CreateRoomResponse,
  RefreshTokenResponse,
  RoomMember,
  RoomEvent,
} from "./types";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
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
        headers: { "x-better-auth-token": token },
      },
    );

    if (error) {
      console.error(`[VideoApi] ${functionName} invoke error:`, error);
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
    console.error(`[VideoApi] ${functionName} error:`, err);
    return {
      ok: false,
      error: {
        code: "internal_error",
        message: err.message || "Network error",
      },
    };
  }
}

export const videoApi = {
  /**
   * Create a new video room
   */
  async createRoom(params: {
    title: string;
    isPublic?: boolean;
    maxParticipants?: number;
  }): Promise<ApiResponse<CreateRoomResponse>> {
    return callEdgeFunction<CreateRoomResponse>("video_create_room", params);
  },

  /**
   * Join a video room and get Fishjam token
   */
  async joinRoom(roomId: string): Promise<ApiResponse<JoinRoomResponse>> {
    return callEdgeFunction<JoinRoomResponse>("video_join_room", { roomId });
  },

  /**
   * Refresh Fishjam token for an active session
   */
  async refreshToken(
    roomId: string,
    currentJti?: string,
  ): Promise<ApiResponse<RefreshTokenResponse>> {
    return callEdgeFunction<RefreshTokenResponse>("video_refresh_token", {
      roomId,
      currentJti,
    });
  },

  /**
   * Kick a user from the room (temporary)
   */
  async kickUser(params: {
    roomId: string;
    targetUserId: string;
    reason?: string;
  }): Promise<ApiResponse<{ kicked: boolean }>> {
    return callEdgeFunction("video_kick_user", params);
  },

  /**
   * Ban a user from the room (persistent)
   */
  async banUser(params: {
    roomId: string;
    targetUserId: string;
    reason?: string;
    durationMinutes?: number;
  }): Promise<ApiResponse<{ banned: boolean; expiresAt?: string }>> {
    return callEdgeFunction("video_ban_user", params);
  },

  /**
   * End the room (host only)
   */
  async endRoom(roomId: string): Promise<ApiResponse<{ ended: boolean }>> {
    return callEdgeFunction("video_end_room", { roomId });
  },

  /**
   * Get room details
   */
  async getRoom(roomId: string): Promise<VideoRoom | null> {
    const { data, error } = await supabase
      .from("video_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title,
      isPublic: data.is_public,
      status: data.status,
      maxParticipants: data.max_participants,
      fishjamRoomId: data.fishjam_room_id,
      createdBy: data.created_by,
      createdAt: data.created_at,
      endedAt: data.ended_at,
    };
  },

  /**
   * Get room members
   */
  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const { data, error } = await supabase
      .from("video_room_members")
      .select(
        `
        room_id,
        user_id,
        role,
        status,
        joined_at,
        left_at,
        users!inner(username, avatar)
      `,
      )
      .eq("room_id", roomId)
      .eq("status", "active");

    if (error || !data) return [];

    return data.map((m: any) => ({
      roomId: m.room_id,
      userId: m.user_id,
      role: m.role,
      status: m.status,
      joinedAt: m.joined_at,
      leftAt: m.left_at,
      username: m.users?.username,
      avatar: m.users?.avatar?.url,
    }));
  },

  /**
   * Get public rooms
   */
  async getPublicRooms(): Promise<VideoRoom[]> {
    const { data, error } = await supabase
      .from("video_rooms")
      .select("*")
      .eq("is_public", true)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((r) => ({
      id: r.id,
      title: r.title,
      isPublic: r.is_public,
      status: r.status,
      maxParticipants: r.max_participants,
      fishjamRoomId: r.fishjam_room_id,
      createdBy: r.created_by,
      createdAt: r.created_at,
      endedAt: r.ended_at,
    }));
  },

  /**
   * Get user's rooms (as member)
   */
  async getMyRooms(): Promise<VideoRoom[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("video_room_members")
      .select(
        `
        video_rooms!inner(*)
      `,
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("video_rooms.status", "open");

    if (error || !data) return [];

    return data.map((m: any) => ({
      id: m.video_rooms.id,
      title: m.video_rooms.title,
      isPublic: m.video_rooms.is_public,
      status: m.video_rooms.status,
      maxParticipants: m.video_rooms.max_participants,
      fishjamRoomId: m.video_rooms.fishjam_room_id,
      createdBy: m.video_rooms.created_by,
      createdAt: m.video_rooms.created_at,
      endedAt: m.video_rooms.ended_at,
    }));
  },

  /**
   * Subscribe to room events (for kick/ban/end notifications)
   */
  subscribeToRoomEvents(
    roomId: string,
    userId: string,
    onEvent: (event: RoomEvent) => void,
  ) {
    const channel = supabase
      .channel(`video_room_events:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_room_events",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const event = payload.new as any;
          // Only process events targeting this user or room-wide events
          if (
            !event.target_id ||
            event.target_id === userId ||
            event.type === "room_ended"
          ) {
            onEvent({
              id: event.id,
              roomId: event.room_id,
              type: event.type,
              actorId: event.actor_id,
              targetId: event.target_id,
              payload: event.payload,
              createdAt: event.created_at,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to member changes
   */
  subscribeToMembers(
    roomId: string,
    onMemberChange: (
      member: RoomMember,
      eventType: "INSERT" | "UPDATE" | "DELETE",
    ) => void,
  ) {
    const channel = supabase
      .channel(`video_room_members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const member = (payload.new || payload.old) as any;

          // Fetch user details
          const { data: userData } = await supabase
            .from("users")
            .select("username, avatar")
            .eq("auth_id", member.user_id)
            .single();

          onMemberChange(
            {
              roomId: member.room_id,
              userId: member.user_id,
              role: member.role,
              status: member.status,
              joinedAt: member.joined_at,
              leftAt: member.left_at,
              username: userData?.username,
              avatar: userData?.avatar?.url,
            },
            payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
