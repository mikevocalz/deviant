/**
 * Video Chat Type Definitions
 */

export type RoomStatus = "open" | "ended";
export type MemberRole = "host" | "moderator" | "participant";
export type MemberStatus = "active" | "left" | "kicked" | "banned";
export type EventType =
  | "room_created"
  | "room_ended"
  | "member_joined"
  | "member_left"
  | "member_kicked"
  | "member_banned"
  | "role_changed"
  | "token_issued"
  | "token_revoked"
  | "eject";

export interface VideoRoom {
  id: string;
  title: string;
  isPublic: boolean;
  status: RoomStatus;
  maxParticipants: number;
  fishjamRoomId?: string;
  createdBy: string;
  createdAt: string;
  endedAt?: string;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  leftAt?: string;
  // Populated from users table
  username?: string;
  avatar?: string;
}

export interface RoomEvent {
  id: string;
  roomId: string;
  type: EventType;
  actorId?: string;
  targetId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface EjectPayload {
  action: "kick" | "ban";
  reason?: string;
  expiresAt?: string;
}

export interface JoinRoomResponse {
  room: {
    id: string;
    title: string;
    fishjamRoomId: string;
  };
  token: string;
  peer: {
    id: string;
    role: MemberRole;
  };
  user: {
    id: string;
    username?: string;
    avatar?: string;
  };
  expiresAt: string;
}

export interface CreateRoomResponse {
  room: VideoRoom;
}

export interface RefreshTokenResponse {
  token: string;
  peer: {
    id: string;
    role: MemberRole;
  };
  expiresAt: string;
}

export interface Participant {
  odId: string;
  oderId: string;
  userId: string;
  username?: string;
  avatar?: string;
  role: MemberRole;
  isLocal: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  videoTrack?: any;
  audioTrack?: any;
}

export interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
  error?: string;
}

export interface VideoRoomState {
  room: VideoRoom | null;
  localUser: {
    id: string;
    username?: string;
    avatar?: string;
    role: MemberRole;
    peerId?: string;
  } | null;
  participants: Participant[];
  connectionState: ConnectionState;
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;
  isEjected: boolean;
  ejectReason?: EjectPayload;
}
