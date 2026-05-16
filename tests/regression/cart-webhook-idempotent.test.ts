import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Cart webhook issuance idempotency", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");
  const webhook = read("supabase/functions/stripe-webhook/index.ts");
  const migration = read(
    "supabase/migrations/20260516150000_mixed_cart_checkout.sql",
  );

  it("routes cart PaymentIntent success through the cart issuance RPC", () => {
    expect(webhook).toContain('piMetadata.type === "cart_checkout"');
    expect(webhook).toContain("handleCartPaymentIntentSucceeded(supabase, pi)");
    expect(webhook).toContain('"cart_complete_issuance"');
    expect(webhook).toContain("p_payment_intent_id: pi.id");
    expect(webhook).toContain("p_ticket_rows: preparedTicketRows");
  });

  it("pre-computes HMAC QR payloads in Deno before the atomic insert", () => {
    expect(webhook).toContain("prepareCartTicketRows");
    expect(webhook).toContain("crypto.randomUUID()");
    expect(webhook).toContain("createSignedQrPayload(");
    expect(migration).toContain("p_ticket_rows jsonb");
    expect(migration).toContain("v_prepared.qr_payload");
  });

  it("makes duplicate webhook delivery a cart-status no-op", () => {
    expect(webhook).toContain("issuanceResult.duplicate");
    expect(webhook).toContain("Cart already completed, skipping issuance");
    expect(migration).toContain("if v_cart.status = 'completed' then");
    expect(migration).toContain("'duplicate', true");
  });

  it("keeps ticket issuance, cart completion, and hold release in one database function", () => {
    expect(migration).toContain("insert into public.tickets");
    expect(migration).toContain("cart_line_item_id");
    expect(migration).toContain("qr_payload");
    expect(migration).toContain(
      "set quantity_sold = coalesce(quantity_sold, 0)",
    );
    expect(migration).toContain("update public.cart_holds");
    expect(migration).toContain("set status = 'completed'");
  });

  it("refunds the full PaymentIntent if allocation fails after payment succeeds", () => {
    expect(webhook).toContain("refundPaymentIntentForAllocationFailure");
    expect(webhook).toContain(
      '"metadata[reason]": "system_allocation_failure"',
    );
    expect(webhook).toContain("allocation_failure_${paymentIntentId}");
    expect(webhook).toContain('status: "payment_failed"');
  });
});
