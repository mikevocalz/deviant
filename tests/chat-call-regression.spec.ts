import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeChatParams } from "../lib/navigation/chat-routes";
import { deriveCallUiMode } from "../src/features/calls/ui/deriveCallUiMode";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

describe("Canonical chat routing", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("does not fall back to a fake thread id when route params are missing", () => {
    expect(normalizeChatParams({}).chatId).toBeNull();
    expect(
      normalizeChatParams({
        id: ["76"],
        peerUsername: ["mikasa"],
      }),
    ).toEqual({
      chatId: "76",
      peerAvatar: undefined,
      peerUsername: "mikasa",
      peerName: undefined,
    });
  });

  it("requires numeric canonical conversation ids for navigation", () => {
    const source = read("lib/navigation/chat-routes.ts");
    expect(source).toContain("requires a canonical numeric conversationId");
    expect(source).not.toContain('normalize(rawParams.id) || "1"');
  });

  it("messages and profile entry points route through the shared helper", () => {
    const messagesSource = read("app/(protected)/messages.tsx");
    const profileSource = read("app/(protected)/profile/[username].tsx");

    expect(messagesSource).toContain("navigateToChat(router");
    expect(profileSource).toContain("navigateToChat(router");
    expect(messagesSource).not.toContain('router.push(`/(protected)/chat/');
    expect(profileSource).not.toContain('router.push(`/(protected)/chat/');
  });
});

describe("Call UI state + group call ownership", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("surfaces reconnecting as a first-class call mode", () => {
    expect(
      deriveCallUiMode({
        role: "caller",
        phase: "reconnecting",
        callType: "video",
        remoteJoined: true,
        connectionStatus: "connected",
      }),
    ).toBe("RECONNECTING");

    expect(
      deriveCallUiMode({
        role: "callee",
        phase: "joining_room",
        callType: "audio",
        remoteJoined: false,
        connectionStatus: "connected",
      }),
    ).toBe("RECEIVER_CONNECTING");
  });

  it("treats multiple participants as a group call even when the route hint is stale", () => {
    const source = read("src/features/calls/ui/CallScreen.tsx");
    expect(source).toContain(
      "const effectiveIsGroupCall = isGroupCall || participants.length > 1;",
    );
    expect(source).toContain("<GroupCallStage");
    expect(source).toContain('showParticipantsButton={false}');
    expect(source).toContain("BottomSheetModal");
    expect(source).toContain('case "RECONNECTING":');
  });

  it("keeps the group participants entry point in the stage header, not the crowded bottom dock", () => {
    const stageSource = read("src/features/calls/ui/stages/GroupCallStage.tsx");
    const controlsSource = read("src/features/calls/ui/controls/CallControls.tsx");

    expect(stageSource).toContain("Open participants");
    expect(stageSource).toContain("People");
    expect(controlsSource).toContain('showParticipantsButton = false');
    expect(controlsSource).toContain("Open participants");
  });
});
