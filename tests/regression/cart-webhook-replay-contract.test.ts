import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Cart webhook replay contract", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const webhook = read("supabase/functions/stripe-webhook/index.ts");
  const issuanceMigration = read(
    "supabase/migrations/20260516150000_mixed_cart_checkout.sql",
  );
  const refundMigration = read(
    "supabase/migrations/20260516170000_cart_line_refund_rpc.sql",
  );

  it("handles payment_intent.succeeded replay through completed-cart idempotency", () => {
    expect(webhook).toContain("handleCartPaymentIntentSucceeded(supabase, pi)");
    expect(webhook).toContain('"cart_complete_issuance"');
    expect(webhook).toContain("issuanceResult.duplicate");
    expect(issuanceMigration).toContain("if v_cart.status = 'completed' then");
    expect(issuanceMigration).toContain("'duplicate', true");
    expect(issuanceMigration).toContain("where cart_id = p_cart_id");
    expect(issuanceMigration).toContain("'issuedCount', v_existing_count");
  });

  it("keeps replayed line-item refunds idempotent and scoped", () => {
    expect(webhook).toContain("refundedLineItemIds.length > 0");
    expect(webhook).toContain("cart_apply_line_refund");
    expect(refundMigration).toContain(
      "where idempotency_key = p_idempotency_key",
    );
    expect(refundMigration).toContain("alreadyApplied");
    expect(refundMigration).toContain("cart_line_item_id = p_line_item_id");
  });
});
