import { readFileSync } from "node:fs";
import { join } from "node:path";
import { partitionConversationsByFollowState } from "../lib/messages/conversation-buckets";

describe("Messages unread routing", () => {
  it("routes followed direct threads to Inbox and unfollowed threads to Requests", () => {
    const conversations = [
      { id: "followed", user: { id: "2" }, isGroup: false },
      { id: "request", user: { id: "3" }, isGroup: false },
    ];

    const buckets = partitionConversationsByFollowState(conversations, ["2"]);

    expect(buckets.primary.map((c) => c.id)).toEqual(["followed"]);
    expect(buckets.requests.map((c) => c.id)).toEqual(["request"]);
  });

  it("keeps directs in Inbox when follow state is unavailable", () => {
    const conversations = [
      { id: "followed", user: { id: "2" }, isGroup: false },
      { id: "unknown", user: { id: "3" }, isGroup: false },
    ];

    const buckets = partitionConversationsByFollowState(conversations, [], {
      isAuthoritative: false,
    });

    expect(buckets.primary.map((c) => c.id)).toEqual(["followed", "unknown"]);
    expect(buckets.requests).toEqual([]);
  });

  it("always keeps group chats in Inbox", () => {
    const conversations = [
      { id: "group", user: { id: "999" }, isGroup: true },
      { id: "request", user: { id: "3" }, isGroup: false },
    ];

    const buckets = partitionConversationsByFollowState(conversations, []);

    expect(buckets.primary.map((c) => c.id)).toEqual(["group"]);
    expect(buckets.requests.map((c) => c.id)).toEqual(["request"]);
  });
});

describe("Messages unread source invariants", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("get-following-ids resolves the integer viewer id before querying follows", () => {
    const source = read("supabase/functions/get-following-ids/index.ts");
    expect(source).toContain('"id"');
    expect(source).toContain('.eq("follower_id", userData.id)');
    expect(source).toContain("authoritative: true");
    expect(source).toContain("authoritative: false");
  });

  it("bootstrap-messages excludes the viewer's own integer sender_id from unread counts", () => {
    const source = read("supabase/functions/bootstrap-messages/index.ts");
    expect(source).toContain('.neq("sender_id", userIntId)');
    expect(source).not.toContain('.neq("sender_id", authId)');
  });

  it("bootstrap-messages fails open when follow-state lookup is unavailable", () => {
    const source = read("supabase/functions/bootstrap-messages/index.ts");
    expect(source).toContain("const followingIdsKnown = !followingError");
    expect(source).toContain("!followingIdsKnown || isFollowed || !!conv.is_group");
  });

  it("messages caches use viewer-scoped filtered keys instead of raw unscoped prefixes", () => {
    const messagesScreen = read("app/(protected)/messages.tsx");
    const chatScreen = read("app/(protected)/chat/[id].tsx");
    const bootstrapHook = read("lib/hooks/use-bootstrap-messages.ts");

    expect(messagesScreen).not.toContain('queryKey: ["messages", "filtered"]');
    expect(chatScreen).not.toContain('queryKey: ["messages", "filtered"]');
    expect(bootstrapHook).not.toContain('["messages", "filtered", "primary", userId]');
  });
});
