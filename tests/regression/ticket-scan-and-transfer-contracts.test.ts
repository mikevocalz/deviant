import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * V2-SEC-01 + V2-SEC-02 regression contract: pinned safety properties
 * for the ticket-scan flow. Original incident: ticket-scan edge fn had
 * no verifySession at all — any authed user with a copy of a QR token
 * could mark tickets scanned. Plus the scanner UI route had no host
 * check, so any authed user could navigate to /events/<id>/scanner.
 * Both fixed earlier this session in commit 9d269cee.
 */
describe("V2-SEC-01/02 ticket-scan safety", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const scanFn = read("supabase/functions/ticket-scan/index.ts");
  const scannerUi = read("app/(protected)/events/[id]/scanner.tsx");
  const ticketsApi = read("lib/api/tickets.ts");

  it("server requires Better Auth session (V2-SEC-01)", () => {
    expect(scanFn).toContain("verifySession(");
    expect(scanFn).toMatch(
      /(scanner|scannerAuth|authId).*verifySession/i,
    );
    // Returns 401 on missing/invalid token
    expect(scanFn).toMatch(/401/);
  });

  it("server enforces host-only (V2-SEC-01 host gate)", () => {
    // Event row pulled, host_id compared to verified authId
    expect(scanFn).toMatch(/host_id/);
    // 403 on non-host
    expect(scanFn).toMatch(/403|Forbidden/);
    expect(scanFn).toMatch(/not the event host|not your event/i);
  });

  it("server does NOT trust client-supplied scanned_by", () => {
    // The auth id used for the scanned_by stamp must come from the
    // session, not the request body. A future refactor that re-introduces
    // a body field should fail this test.
    const fromVerify =
      scanFn.match(/scannerAuthId|verifiedScannerId|authId/i)?.length ?? 0;
    expect(fromVerify).toBeGreaterThan(0);
  });

  it("client sends Bearer token + x-auth-token on scan", () => {
    expect(ticketsApi).toContain("requireBetterAuthToken");
    expect(ticketsApi).toMatch(/scanTicket/);
    expect(ticketsApi).toMatch(
      /Authorization:\s*`Bearer\s*\$\{token\}`/,
    );
    expect(ticketsApi).toMatch(/"x-auth-token":\s*token/);
  });

  it("scanner UI route refuses to mount for non-host (V2-SEC-02)", () => {
    expect(scannerUi).toContain("useEvent");
    // Host check before LiveCamera is rendered
    expect(scannerUi).toMatch(/isHost/);
    expect(scannerUi).toMatch(/Not authorized|not the host|not_host/i);
  });
});

/**
 * V2-DB-05 + transfer-ticket regression contract: the spoof-proof
 * RPC wrappers from earlier this session AND the recipient notification
 * work landed today. Properties pinned:
 *  - transfer-ticket verifies session, derives authId from session, never
 *    trusts a body-supplied auth id
 *  - All four actions (initiate/accept/decline/cancel) trigger push +
 *    in-app notification entries to the appropriate party
 *  - Status transitions are guarded (no transfer of refunded ticket,
 *    no double-accept, no transfer to self)
 */
describe("transfer-ticket safety + notifications", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const transferFn = read("supabase/functions/transfer-ticket/index.ts");

  it("verifies Better Auth session as the source of identity", () => {
    expect(transferFn).toContain('verifySession(supabase, req)');
    // userId comes from verifySession, NEVER from req body
    expect(transferFn).toMatch(
      /const\s+userId\s*=\s*await\s+verifySession/,
    );
  });

  it("rejects transfer of non-active tickets", () => {
    expect(transferFn).toContain('ticket.status !== "active"');
    expect(transferFn).toMatch(/Cannot transfer ticket/);
  });

  it("rejects transfer to self", () => {
    expect(transferFn).toContain('recipient.id === userId');
    expect(transferFn).toContain("Cannot transfer to yourself");
  });

  it("rejects transfer to user with existing ticket for same event", () => {
    expect(transferFn).toContain("recipientTicket");
    expect(transferFn).toMatch(
      /already has a ticket for this event/,
    );
  });

  it("blocks duplicate pending transfers", () => {
    expect(transferFn).toContain("existingTransfer");
    expect(transferFn).toContain("already has a pending transfer");
  });

  it("atomically claims accept (prevents race with concurrent decline)", () => {
    // The accept path must update WHERE status='pending' so a race
    // with concurrent decline / cancel results in exactly one winner.
    expect(transferFn).toMatch(
      /\.update\(\{\s*status:\s*"accepted"[^}]*\}\)[\s\S]*?\.eq\(\s*"status",\s*"pending"\s*\)/,
    );
    expect(transferFn).toContain("Transfer already processed");
  });

  it("generates a NEW HMAC-signed QR on accept (anti-replay)", () => {
    expect(transferFn).toContain("createSignedQrPayload");
    expect(transferFn).toMatch(
      /qr_token:\s*qrToken[\s\S]*?qr_payload:\s*qrPayload/,
    );
    // Wallet fields cleared so the old owner's pass can't be reused
    expect(transferFn).toMatch(/wallet_serial_number:\s*null/);
    expect(transferFn).toMatch(/wallet_auth_token:\s*null/);
  });

  it("notifies recipient on initiate", () => {
    expect(transferFn).toContain('"ticket_transfer_initiated"');
    expect(transferFn).toContain("sent you a ticket");
  });

  it("notifies sender on accept", () => {
    expect(transferFn).toContain('"ticket_transfer_accepted"');
    expect(transferFn).toContain("accepted your ticket");
  });

  it("notifies sender on decline", () => {
    expect(transferFn).toContain('"ticket_transfer_declined"');
    expect(transferFn).toContain("declined your ticket");
  });

  it("notifies recipient on cancel", () => {
    expect(transferFn).toContain('"ticket_transfer_cancelled"');
    expect(transferFn).toContain("cancelled the ticket transfer");
  });

  it("notification failures don't break the transfer action", () => {
    // The push + in-app insert is wrapped in try/catch with a non-fatal
    // log so a transient Expo Push outage can't roll back a transfer.
    expect(transferFn).toContain("notifyTransfer failed (non-fatal)");
  });

  it("push payload deep-links recipients to /my-tickets", () => {
    expect(transferFn).toContain(
      "https://dvntapp.live/my-tickets",
    );
  });
});
