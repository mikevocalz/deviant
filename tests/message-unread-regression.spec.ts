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

  it("bootstrap-messages resolves either users.id or users.auth_id before loading conversations", () => {
    const source = read("supabase/functions/bootstrap-messages/index.ts");
    expect(source).toContain('String(asInt) === String(user_id)');
    expect(source).toContain('.eq("auth_id", user_id)');
  });

  it("bootstrap-messages fails open when follow-state lookup is unavailable", () => {
    const source = read("supabase/functions/bootstrap-messages/index.ts");
    expect(source).toContain("const followingIdsKnown = !followingError");
    expect(source).toContain("!followingIdsKnown || isFollowed || !!conv.is_group");
  });

  it("bootstrap-messages only seeds unread counts when the backend marks them authoritative", () => {
    const source = read("lib/hooks/use-bootstrap-messages.ts");
    expect(source).toContain("if (data.unreadAuthoritative)");
    expect(source).toContain("authoritative=${data.unreadAuthoritative === true}");
    expect(source).toContain('queryClient.setQueryData(\n      [...messageKeys.all(userId), "filtered", "primary"],');
  });

  it("unread-sensitive message queries always revalidate on mount and reconnect", () => {
    const source = read("lib/hooks/use-messages.ts");
    expect(source).toContain('refetchOnMount: "always"');
    expect(source).toContain('refetchOnReconnect: "always"');
  });

  it("bootstrap-feed derives unread counts from message read state, not legacy conversation counters", () => {
    const source = read("supabase/functions/bootstrap-feed/index.ts");
    expect(source).toContain('from("conversations_rels")');
    expect(source).toContain('.is("read_at", null)');
    expect(source).not.toContain('.gt("unread_count", 0)');
    expect(source).toContain("unreadMessagesAuthoritative");
  });

  it("bootstrap-feed only seeds unread cache when backend confirms the count is authoritative", () => {
    const source = read("lib/hooks/use-bootstrap-feed.ts");
    expect(source).toContain("data.viewer?.unreadMessagesAuthoritative");
    expect(source).toContain("store.setMessagesUnread(data.viewer.unreadMessages)");
  });

  it("send-message reconciles older inbound unread rows when the viewer replies", () => {
    const source = read("supabase/functions/send-message/index.ts");
    expect(source).toContain("Failed to reconcile unread state on reply");
    expect(source).toContain('.update({ read_at: sentAt })');
    expect(source).toContain('.eq("conversation_id", conversationId)');
    expect(source).toContain('.neq("sender_id", userId)');
  });

  it("query persistence buster is bumped so stale unread cache is cleared after OTA", () => {
    const source = read("lib/query-persistence.ts");
    expect(source).toContain('buster: "v9"');
    expect(source).toContain('const currentVersion = "v9"');
  });

  it("boot prefetch loads unread counts from the combined unread source of truth", () => {
    const source = read("lib/hooks/use-boot-prefetch.ts");
    expect(source).toContain("queryFn: () => messagesApiClient.getUnreadCounts()");
    expect(source).not.toContain("messagesApiClient.getUnreadCount()");
    expect(source).not.toContain("messagesApiClient.getSpamUnreadCount()");
  });

  it("adds a production migration for the authoritative conversation_reads table", () => {
    const source = read(
      "supabase/migrations/20260401004000_conversation_reads.sql",
    );
    expect(source).toContain("CREATE TABLE IF NOT EXISTS public.conversation_reads");
    expect(source).toContain("INSERT INTO public.conversation_reads");
    expect(source).toContain("UPDATE public.messages m");
  });

  it("adds a one-time group unread cutover for historical group chats", () => {
    const source = read(
      "supabase/migrations/20260401005000_group_unread_cutover.sql",
    );
    expect(source).toContain("latest_group_message");
    expect(source).toContain("WHERE c.is_group = true");
    expect(source).toContain("INSERT INTO public.conversation_reads");
    expect(source).toContain("ON CONFLICT (conversation_id, user_id) DO UPDATE");
  });

  it("realtime message patches compare sender_id against the integer viewer id, not auth-store raw ids", () => {
    const messagesScreen = read("app/(protected)/messages.tsx");
    const chatScreen = read("app/(protected)/chat/[id].tsx");

    expect(messagesScreen).toContain("const currentUserIntId = getCurrentUserIdInt()");
    expect(messagesScreen).not.toContain(
      'String(newMsg.sender_id) === String(currentUser.id)',
    );

    expect(chatScreen).toContain("const userIntId = getCurrentUserIdInt()");
    expect(chatScreen).not.toContain(
      'String(newMsg.sender_id) === String(userId)',
    );
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
