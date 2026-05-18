import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Mixed-cart line-item refunds", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const edge = read("supabase/functions/cart-line-refund/index.ts");
  const webhook = read("supabase/functions/stripe-webhook/index.ts");
  const migration = read(
    "supabase/migrations/20260516170000_cart_line_refund_rpc.sql",
  );
  const ticketsApi = read("lib/api/tickets.ts");
  const ticketDetail = read("app/(protected)/ticket/[id].tsx");
  const dto = read("lib/contracts/dto.ts");

  it("issues Stripe refunds with line-item metadata and idempotency", () => {
    expect(edge).toContain("cart-line-refund Edge Function");
    expect(edge).toContain("verifySession(supabase, req)");
    expect(edge).toContain('"Idempotency-Key": idempotencyKey');
    expect(edge).toContain('"metadata[cart_id]": body.cartId');
    expect(edge).toContain('"metadata[cart_line_item_id]": body.lineItemId');
    expect(edge).toContain('"metadata[line_item_id]": body.lineItemId');
    expect(edge).toContain("amount: String(refundAmountCents)");
  });

  it("applies refund state through one atomic RPC", () => {
    expect(edge).toContain('"cart_apply_line_refund"');
    expect(migration).toContain(
      "create or replace function public.cart_apply_line_refund",
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("update public.cart_line_items");
    expect(migration).toContain("refunded_amount_cents");
    expect(migration).toContain("update public.tickets");
    expect(migration).toContain("cart_line_item_id = p_line_item_id");
    expect(migration).toContain("update public.orders");
  });

  it("keeps Stripe webhook partial refunds scoped to the refunded line", () => {
    expect(webhook).toContain("refundedLineItemIds");
    expect(webhook).toContain("cart_apply_line_refund");
    expect(webhook).toContain(
      "cart_line_refund_${lineItemId}_${refund.amount}",
    );
    expect(webhook).toContain('"cart_line_item_id"');
    expect(webhook).toContain("refundedLineItemIds.length > 0");
  });

  it("surfaces line refunds through a DTO-validated API and ticket detail UI", () => {
    expect(dto).toContain("CartLineRefundResponseDTO");
    expect(ticketsApi).toContain("requestLineRefund");
    expect(ticketsApi).toContain("parseDTO(CartLineRefundResponseDTO");
    expect(ticketDetail).toContain("ticketsApi.requestLineRefund");
    expect(ticketDetail).toContain("dbTicket.cart_line_item_id");
    expect(ticketDetail).toContain(
      "Other items from the same checkout stay active",
    );
  });
});
