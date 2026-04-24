/**
 * Sneaky Lynk error translation layer.
 *
 * Turns raw backend error codes + messages into a typed, UI-ready
 * classification. The room screen renders a dedicated polished sheet
 * per reason instead of dumping the raw message. Keeps user copy in
 * ONE place so designers can iterate.
 *
 * Backend error contract (from src/sneaky-lynk/api/supabase.ts):
 *   code ∈ "unauthorized" | "forbidden" | "not_found" | "conflict"
 *        | "rate_limited" | "validation_error" | "internal_error"
 *   message: string
 *
 * Known capacity signal: `code: "conflict"`, `message: "Room is full"`
 * (supabase/functions/video_join_room/index.ts:184).
 */

export type SneakyLynkErrorReason =
  | "room_full"
  | "room_ended"
  | "rate_limited"
  | "forbidden"
  | "not_found"
  | "unauthorized"
  | "unknown";

export interface ClassifiedError {
  reason: SneakyLynkErrorReason;
  /** User-facing title — short, tasteful, no jargon. */
  title: string;
  /** User-facing body — explains what happened + what to do. */
  body: string;
  /** Primary-action label (null = close only). */
  ctaLabel: string | null;
  /** The raw message, preserved for debug logs. NEVER shown to users. */
  rawMessage: string;
}

const ROOM_FULL_MATCHERS = [/room is full/i, /at capacity/i, /room full/i];
const ROOM_ENDED_MATCHERS = [
  /no longer open/i,
  /already ended/i,
  /has ended/i,
  /room not found/i,
  /session ended/i,
];

export function classifySneakyLynkError(
  code: string | undefined,
  message: string | undefined,
): ClassifiedError {
  const raw = message ?? "";

  // Capacity — the reason we're building this layer in the first place.
  if (
    code === "conflict" &&
    ROOM_FULL_MATCHERS.some((re) => re.test(raw))
  ) {
    return {
      reason: "room_full",
      title: "This room is full",
      body:
        "Every spot is taken right now. Hang tight — if someone leaves, you can try again in a few seconds.",
      ctaLabel: "Try again",
      rawMessage: raw,
    };
  }

  if (
    code === "not_found" ||
    ROOM_ENDED_MATCHERS.some((re) => re.test(raw))
  ) {
    return {
      reason: "room_ended",
      title: "This room has ended",
      body: "The host wrapped up. Check the host's profile for their next one.",
      ctaLabel: null,
      rawMessage: raw,
    };
  }

  if (code === "rate_limited") {
    return {
      reason: "rate_limited",
      title: "Too many tries",
      body: "You're trying to join a little too fast. Give it a moment and try again.",
      ctaLabel: "OK",
      rawMessage: raw,
    };
  }

  if (code === "forbidden") {
    return {
      reason: "forbidden",
      title: "You can't join this room",
      body: "Only invited participants can join. Reach out to the host for access.",
      ctaLabel: null,
      rawMessage: raw,
    };
  }

  if (code === "unauthorized") {
    return {
      reason: "unauthorized",
      title: "Sign in to join",
      body: "You need to be signed in to join a Sneaky Lynk room.",
      ctaLabel: "Sign in",
      rawMessage: raw,
    };
  }

  // Fallback — NEVER show the raw backend string.
  return {
    reason: "unknown",
    title: "Something went wrong",
    body: "We couldn't join this room right now. Try again in a moment.",
    ctaLabel: "Try again",
    rawMessage: raw,
  };
}
