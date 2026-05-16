import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("get-cart-status recovery edge function", () => {
  const source = readFileSync(
    join(process.cwd(), "supabase/functions/get-cart-status/index.ts"),
    "utf8",
  );

  it("is Better Auth protected and owner scoped", () => {
    expect(source).toContain("verifySession(supabase, req)");
    expect(source).toContain(
      'if (!authId) return errorResponse("Unauthorized", 401)',
    );
    expect(source).toContain("cart.user_id !== authId");
    expect(source).toContain("Cart not found");
  });

  it("returns cart, line item, hold, and ticket state for recovery", () => {
    expect(source).toContain('.from("carts")');
    expect(source).toContain('.from("cart_line_items")');
    expect(source).toContain('.from("cart_holds")');
    expect(source).toContain('.from("tickets")');
    expect(source).toContain('completed: cart.status === "completed"');
  });

  it("only returns tickets owned by the authenticated user", () => {
    expect(source).toContain('.eq("cart_id", cartId)');
    expect(source).toContain('.eq("user_id", authId)');
    expect(source).toContain("qr_payload");
  });
});
