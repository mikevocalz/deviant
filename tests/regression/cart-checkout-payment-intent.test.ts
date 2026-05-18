import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Cart checkout PaymentIntent edge function", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");
  const checkout = read("supabase/functions/cart-checkout/index.ts");
  const migration = read(
    "supabase/migrations/20260516150000_mixed_cart_checkout.sql",
  );

  it("requires Better Auth and buyer-owned cart access", () => {
    expect(checkout).toContain("verifySession(supabase, req)");
    expect(checkout).toContain(
      'if (!authId) return errorResponse("Unauthorized", 401)',
    );
    expect(checkout).toContain("cart.user_id !== authId");
    expect(checkout).toContain("Cart not found");
  });

  it("requires an active cart hold before creating a PaymentIntent", () => {
    expect(checkout).toContain("Create a cart hold before checkout");
    expect(checkout).toContain('.from("cart_holds")');
    expect(checkout).toContain('.eq("released", false)');
    expect(checkout).toContain('.gt("expires_at", new Date().toISOString())');
    expect(checkout).toContain("hold_expired");
    expect(checkout).toContain('"cart_release_hold"');
  });

  it("creates one cart-scoped PaymentIntent with Stripe idempotency", () => {
    expect(checkout).toContain(
      "const stripeIdempotencyKey = `cart_pi_${cart.idempotency_key}`",
    );
    expect(checkout).toContain(
      'headers["Idempotency-Key"] = options.idempotencyKey',
    );
    expect(checkout).toContain('"metadata[type]": "cart_checkout"');
    expect(checkout).toContain('"metadata[cart_id]": cartId');
    expect(checkout).not.toContain('"metadata[line_items]"');
  });

  it("stores cart totals and maintains one order per cart", () => {
    expect(checkout).toContain("computeFees(subtotalCents, quantity)");
    expect(checkout).toContain('status: "paying"');
    expect(checkout).toContain("stripe_pi_id: pi.id");
    expect(checkout).toContain('onConflict: "cart_id"');
    expect(migration).toContain("create unique index idx_orders_cart_id");
  });
});
