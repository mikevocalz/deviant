/**
 * V2-DB-05 regression contract: the two edge functions that wrap the
 * previously-spoofable SECURITY DEFINER RPCs must keep their auth
 * shape so the spoofing hole doesn't reopen.
 *
 * Background — both `issue_rsvp_ticket(p_event_id, p_user_auth_id)`
 * and `submit_verification_request(p_user_auth_id, ...)` accepted the
 * caller's auth_id as a client-controlled parameter. Any logged-in
 * user could pass another user's id. The fix routes both through
 * edge functions that:
 *  1. verifySession() against the Better Auth session table
 *  2. Derive auth_id from the SESSION, not from the request body
 *  3. Call the underlying RPC via service_role with the derived id
 *
 * Plus a separate DB migration revoked `authenticated` EXECUTE on
 * both RPCs so the edge function is the only path.
 *
 * If any of these guarantees regress, this test catches it before
 * the spoofability returns.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("V2-DB-05 spoof-proof RPC wrappers", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const rsvpEdge = read("supabase/functions/rsvp-issue-ticket/index.ts");
  const verifEdge = read("supabase/functions/submit-verification/index.ts");
  const ticketsApi = read("lib/api/tickets.ts");
  const usersApi = read("lib/api/users.ts");

  describe("rsvp-issue-ticket edge function", () => {
    it("verifies the session before doing anything", () => {
      expect(rsvpEdge).toContain('verifySession(supabase, req)');
      expect(rsvpEdge).toMatch(/if \(!authUserId\)[\s\S]*unauthorized/);
    });

    it("derives p_user_auth_id from the verified session, not from the request body", () => {
      // The RPC call must use the session-derived id directly.
      expect(rsvpEdge).toContain('p_user_auth_id: authUserId');
      // It must NOT read a user/auth id from the request body.
      expect(rsvpEdge).not.toMatch(/body\.(userId|authId|userAuthId|user_auth_id|p_user_auth_id)/);
    });

    it("validates eventId as a positive integer before calling the RPC", () => {
      expect(rsvpEdge).toContain('Number.isFinite(eventIdInt)');
      expect(rsvpEdge).toContain('eventIdInt <= 0');
    });

    it("rate-limits the endpoint to prevent griefing", () => {
      expect(rsvpEdge).toContain('checkRateLimit');
      expect(rsvpEdge).toContain('rsvp-issue-ticket');
    });
  });

  describe("submit-verification edge function", () => {
    it("verifies the session before doing anything", () => {
      expect(verifEdge).toContain('verifySession(supabase, req)');
      expect(verifEdge).toMatch(/if \(!authUserId\)[\s\S]*unauthorized/);
    });

    it("derives p_user_auth_id from the verified session, not from the request body", () => {
      expect(verifEdge).toContain('p_user_auth_id: authUserId');
      // The body is allowed to carry `reason` and `socialUrl` but NEVER a user id.
      expect(verifEdge).not.toMatch(/body\.(userId|authId|userAuthId|user_auth_id|p_user_auth_id)/);
    });

    it("caps free-text length so the RPC can't be used as a write-amplification vector", () => {
      expect(verifEdge).toContain('MAX_REASON_LEN');
      expect(verifEdge).toContain('MAX_URL_LEN');
    });

    it("rate-limits the endpoint", () => {
      expect(verifEdge).toContain('checkRateLimit');
      expect(verifEdge).toContain('submit-verification');
    });
  });

  describe("client callers route through the edge functions, never the raw RPCs", () => {
    it("issueRsvpTicket invokes the rsvp-issue-ticket edge function, not the raw RPC", () => {
      expect(ticketsApi).toMatch(/invokeEdge[^"]*"rsvp-issue-ticket"/);
      // The raw RPC name must NOT appear in the client API surface.
      expect(ticketsApi).not.toContain('supabase.rpc("issue_rsvp_ticket"');
    });

    it("submitVerificationRequest invokes the submit-verification edge function, not the raw RPC", () => {
      expect(usersApi).toMatch(/invokeEdge[^"]*"submit-verification"/);
      expect(usersApi).not.toContain('supabase.rpc("submit_verification_request"');
    });

    it("neither client caller passes a user/auth id in the request body", () => {
      // issueRsvpTicket must only send eventId now.
      const rsvpBody = ticketsApi.match(/"rsvp-issue-ticket",\s*\{[^}]+\}/);
      expect(rsvpBody?.[0] ?? "").not.toMatch(/userId|authId|user_auth_id/);

      const verifBody = usersApi.match(/"submit-verification",\s*\{[^}]+\}/);
      expect(verifBody?.[0] ?? "").not.toMatch(/userId|authId|user_auth_id/);
    });
  });
});
