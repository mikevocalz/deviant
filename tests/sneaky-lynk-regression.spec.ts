import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRoomParticipantStats,
  resolveRoomAudience,
} from "../src/sneaky-lynk/api/room-stats";

describe("Sneaky Lynk room audience stats", () => {
  it("preserves historical participant totals for ended rooms", () => {
    const stats = buildRoomParticipantStats([
      {
        room_id: 273,
        user_id: "host",
        status: "left",
        joined_at: "2026-03-27T16:22:41.977471+00:00",
        left_at: "2026-03-27T17:22:30.142+00:00",
      },
      {
        room_id: 273,
        user_id: "guest",
        status: "left",
        joined_at: "2026-03-27T17:21:33.428+00:00",
        left_at: "2026-03-27T17:22:30.142+00:00",
      },
    ]);

    const audience = resolveRoomAudience(
      {
        id: 273,
        status: "ended",
        participant_count: 0,
        created_at: "2026-03-27T16:22:41.887218+00:00",
      },
      stats[273],
      Date.parse("2026-03-28T17:30:00-04:00"),
    );

    expect(audience.listeners).toBe(2);
    expect(audience.isLive).toBe(false);
  });

  it("keeps open rooms live when active member rows exist", () => {
    const now = Date.parse("2026-03-28T17:16:35-04:00");
    const stats = buildRoomParticipantStats(
      [
        {
          room_id: 284,
          user_id: "host",
          status: "active",
          joined_at: "2026-03-28T21:16:24.689798+00:00",
        },
        {
          room_id: 284,
          user_id: "guest",
          status: "active",
          joined_at: "2026-03-28T21:16:31.338489+00:00",
        },
      ],
      now,
    );

    const audience = resolveRoomAudience(
      {
        id: 284,
        status: "open",
        participant_count: 1,
        created_at: "2026-03-28T21:16:24.000000+00:00",
      },
      stats[284],
      now,
    );

    expect(audience.listeners).toBe(2);
    expect(audience.isLive).toBe(true);
  });
});

describe("Sneaky Lynk/video join safeguards", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("recreates Fishjam rooms when peer creation returns a server error", () => {
    const source = read("supabase/functions/video_join_room/index.ts");
    expect(source).toContain("status >= 500");
    expect(source).toContain(
      "Fishjam peer returned ${addPeerRes.status} — recreating room and retrying",
    );
    expect(source).toContain('method: "DELETE"');
  });

  it("derives ended-room listener counts from membership history instead of the zeroed participant_count", () => {
    const source = read("src/sneaky-lynk/api/supabase.ts");
    expect(source).toContain("buildRoomParticipantStats");
    expect(source).toContain("resolveRoomAudience");
    expect(source).not.toContain(": r.participant_count || 0");
  });

  it("hides the bottom controls when the comments sheet overlay is open", () => {
    const source = read("src/sneaky-lynk/ui/ControlsBar.tsx");
    expect(source).toContain("if (overlayOpen) {");
    expect(source).toContain("setShowEmojiPicker(false);");
    expect(source).toContain('pointerEvents={overlayOpen ? "none" : "box-none"}');
    expect(source).toContain("zIndex: overlayOpen ? 0 : 60");
    expect(source).toContain("elevation: overlayOpen ? 0 : 60");
    expect(source).toContain("opacity: dockVisibility");
    expect(source).toContain("translateY: controlsTranslateY");
  });

  it("shows the raise-hand control only to audience roles", () => {
    const controlsSource = read("src/sneaky-lynk/ui/ControlsBar.tsx");
    const roomSource = read("app/(protected)/sneaky-lynk/room/[id].tsx");

    expect(controlsSource).toContain(
      'const canRaiseHand =\n    localRole === "participant" || localRole === "listener";',
    );
    expect(controlsSource).toContain("canRaiseHand");
    expect(roomSource).toContain(
      'localRole={isHost ? "host" : videoRoom.localUser?.role || "participant"}',
    );
  });

  it("never falls back to a real screen name for anonymous room users", () => {
    const labelsSource = read("src/sneaky-lynk/ui/user-labels.ts");
    const gridSource = read("src/sneaky-lynk/ui/VideoGrid.tsx");
    const stageSource = read("src/sneaky-lynk/ui/VideoStage.tsx");
    const speakerSource = read("src/sneaky-lynk/ui/SpeakerGrid.tsx");

    expect(labelsSource).toContain("if (user.isAnonymous)");
    expect(labelsSource).toContain('return normalizeSneakyAnonLabel(user.anonLabel) || "Anonymous";');
    expect(gridSource).toContain("const showRaisedHandBadge = !!(isHost && isHandRaised);");
    expect(stageSource).toContain("getSneakyUserLabel");
    expect(speakerSource).toContain("getSneakyUserHandle");
    expect(speakerSource).not.toContain("@{speaker.user.username}");
  });
});
