import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * V2-EVT-01 regression contract: pinned safety properties for the
 * cancel-event cascade flow. Static-analysis style — no live Stripe
 * hits, no DB, no device. Verifies the SHAPE of the code so a future
 * refactor that drops idempotency, the host check, or the delete-event
 * guard fails CI immediately.
 *
 * Original incident: delete-event hard-deleted the event row without
 * refunding any tickets. Buyers' tickets pointed at a deleted event,
 * money stuck in Stripe with no path home. Fixed 2026-05-19 in
 * commits b43bc5cd + 320a69bf.
 */
describe("V2-EVT-01 event cancellation cascade", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const cancelFn = read("supabase/functions/cancel-event/index.ts");
  const deleteFn = read("supabase/functions/delete-event/index.ts");
  const eventsApi = read("lib/api/events.ts");
  const privileged = read("lib/api/privileged/index.ts");
  const eventDetail = read("app/(protected)/events/[id]/index.tsx");
  const eventEdit = read("app/(protected)/events/edit/[id].tsx");
  const migration = read(
    "supabase/migrations/20260519181000_events_cancellation_state_columns.sql",
  );

  it("schema: events has status / cancelled_at / cancel_reason with constraint", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS status text");
    expect(migration).toContain("DEFAULT 'active'");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS cancelled_at timestamptz");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS cancel_reason text");
    expect(migration).toContain("events_status_check");
    expect(migration).toMatch(
      /status IN \('draft','active','cancelled','postponed','suspended'\)/,
    );
  });

  it("cancel-event verifies session and host ownership", () => {
    expect(cancelFn).toContain('verifySession(supabase, req)');
    expect(cancelFn).toMatch(/String\(event\.host_id\) !== String\(authId\)/);
    expect(cancelFn).toContain('"Not your event"');
  });

  it("cancel-event short-circuits when already cancelled (idempotent)", () => {
    expect(cancelFn).toContain('event.status === "cancelled"');
    expect(cancelFn).toContain("alreadyCancelled: true");
  });

  it("cancel-event marks event cancelled BEFORE issuing refunds", () => {
    // Critical ordering — scanner attempts in flight must see cancellation
    // before any refund call lands. Use the .update({ status: "cancelled" })
    // call site specifically (not the earlier === check).
    const updateMatch = cancelFn.match(
      /\.update\(\{\s*status:\s*"cancelled"/,
    );
    const stripeCallIdx = cancelFn.indexOf("await stripeRefund(");
    expect(updateMatch).not.toBeNull();
    expect(stripeCallIdx).toBeGreaterThan(-1);
    const updateIdx = updateMatch ? updateMatch.index ?? -1 : -1;
    expect(updateIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeLessThan(stripeCallIdx);
  });

  it("cancel-event uses one Stripe refund per unique payment_intent", () => {
    expect(cancelFn).toContain("piToTickets");
    expect(cancelFn).toContain('payment_intent: pi');
    // Idempotency-Key derived from event + PI so retries collapse
    expect(cancelFn).toMatch(/`cancel-event-\$\{eventId\}-\$\{pi\}`/);
    expect(cancelFn).toContain('"Idempotency-Key": idempotencyKey');
  });

  it("cancel-event voids free tickets directly (no PI)", () => {
    expect(cancelFn).toContain("voidedFreeIds");
    expect(cancelFn).toMatch(/\.update\(\{\s*status:\s*"void"\s*\}\)/);
  });

  it("cancel-event refunds buyers + reverses transfer to organizer", () => {
    expect(cancelFn).toContain('refund_application_fee: "true"');
    expect(cancelFn).toContain('reverse_transfer: "true"');
  });

  it("cancel-event notifies every affected user (push + in-app)", () => {
    expect(cancelFn).toContain('type: "event_cancelled"');
    expect(cancelFn).toContain("push_tokens");
    expect(cancelFn).toContain("exp.host/--/api/v2/push/send");
    // Best-effort wrap — never blocks cancellation
    expect(cancelFn).toContain("notify-attendees failed (non-fatal)");
  });

  it("delete-event 409s when active tickets exist (forces cancel-event)", () => {
    expect(deleteFn).toContain("tickets_exist");
    expect(deleteFn).toMatch(
      /\.in\(\s*["']status["'],\s*\[\s*["']active["']/,
    );
    // Friendly redirect copy
    expect(deleteFn).toContain("Use Cancel Event instead");
  });

  it("client wraps cancelEvent via privileged + invokes cancel-event edge fn", () => {
    expect(privileged).toContain("export async function cancelEvent");
    expect(privileged).toMatch(/invokeEdgeFunction.*["']cancel-event["']/);
    expect(privileged).toContain("CancelEventResult");
  });

  it("host event detail routes Delete through cancelEvent, not deleteEvent", () => {
    // Must call cancelEvent first
    expect(eventDetail).toContain("cancelEventPrivileged");
    // The "All ticket holders will be refunded" copy is in the Alert
    expect(eventDetail).toContain(
      "All ticket holders will be refunded and notified",
    );
    // affectedTickets === 0 fallback to hard delete (race-safe)
    expect(eventDetail).toContain("result.affectedTickets === 0");
  });

  it("edit screen Delete also routes through cancelEvent", () => {
    expect(eventEdit).toContain("cancelEventPrivileged");
    expect(eventEdit).toContain(
      "All ticket holders will be refunded and notified",
    );
  });

  it("cancel propagates status='cancelled' across cached queries", () => {
    expect(eventDetail).toContain("propagateEntity");
    expect(eventDetail).toMatch(/status:\s*["']cancelled["']/);
  });
});

/**
 * V2-EVT-02 regression contract: material-change notification fires
 * only on the four whitelisted change types (date/venue/age) and never
 * blocks the host's save.
 */
describe("V2-EVT-02 material-change attendee notifications", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const notifyFn = read("supabase/functions/notify-event-change/index.ts");
  const eventsApi = read("lib/api/events.ts");

  it("edge fn requires session + host ownership", () => {
    expect(notifyFn).toContain("verifySession(supabase, req)");
    expect(notifyFn).toMatch(/String\(event\.host_id\) !== String\(authId\)/);
    expect(notifyFn).toContain('"Not your event"');
  });

  it("only material change types are accepted", () => {
    expect(notifyFn).toContain("VALID_CHANGES");
    expect(notifyFn).toContain('"start_date"');
    expect(notifyFn).toContain('"end_date"');
    expect(notifyFn).toContain('"location"');
    expect(notifyFn).toContain('"age_restriction"');
  });

  it("no-ops when event is already cancelled", () => {
    expect(notifyFn).toContain('event.status === "cancelled"');
    expect(notifyFn).toContain('skipped: "cancelled"');
  });

  it("notifies both ticket holders AND going RSVPs (deduped)", () => {
    expect(notifyFn).toContain('from("tickets")');
    expect(notifyFn).toContain('from("event_rsvps")');
    expect(notifyFn).toContain('eq("status", "going")');
    expect(notifyFn).toContain("authIdSet");
  });

  it("client updateEvent diffs material fields before firing notify", () => {
    expect(eventsApi).toContain("notify-event-change");
    expect(eventsApi).toContain("materialChanges");
    expect(eventsApi).toContain("normIso");
    // Fire-and-forget — never blocks the host's save
    expect(eventsApi).toContain("notify-event-change failed (non-fatal)");
  });

  it("client pre-fetches event so diff has a before-state", () => {
    expect(eventsApi).toContain("beforeEvent");
    expect(eventsApi).toMatch(/select\([^)]*start_date[^)]*\)/);
  });
});
