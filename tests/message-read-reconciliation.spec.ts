import {
  patchConversationUnreadFlag,
  resolveNextUnreadCounts,
} from "../lib/messages/read-reconciliation-core";

describe("Message read reconciliation", () => {
  it("clears unread on the matching conversation only", () => {
    const input = [
      { id: "1", unread: true },
      { id: "2", unread: false },
    ];

    const result = patchConversationUnreadFlag(input, "1");

    expect(result.didClearUnread).toBe(true);
    expect(result.conversations).toEqual([
      { id: "1", unread: false },
      { id: "2", unread: false },
    ]);
  });

  it("does not rewrite the list when the conversation was already read", () => {
    const input = [{ id: "1", unread: false }];

    const result = patchConversationUnreadFlag(input, "1");

    expect(result.didClearUnread).toBe(false);
    expect(result.conversations).toBe(input);
  });

  it("prefers authoritative server unread totals after mark-as-read", () => {
    const result = resolveNextUnreadCounts(
      { inbox: 3, spam: 1 },
      { inboxCleared: true, spamCleared: false },
      { inbox: 2, spam: 0, authoritative: true },
    );

    expect(result).toEqual({
      inbox: 2,
      spam: 0,
      authoritative: true,
    });
  });

  it("falls back to a local per-conversation decrement when no server snapshot exists", () => {
    const result = resolveNextUnreadCounts(
      { inbox: 3, spam: 2 },
      { inboxCleared: true, spamCleared: true },
      null,
    );

    expect(result).toEqual({
      inbox: 2,
      spam: 1,
      authoritative: false,
    });
  });
});
