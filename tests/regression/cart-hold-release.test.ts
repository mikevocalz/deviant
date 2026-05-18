import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Cart hold edge functions", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");
  const createHold = read("supabase/functions/cart-create-hold/index.ts");
  const releaseHold = read("supabase/functions/cart-release-hold/index.ts");

  it("requires Better Auth session verification before cart writes", () => {
    expect(createHold).toContain("verifySession(supabase, req)");
    expect(createHold).toContain(
      'if (!authId) return errorResponse("Unauthorized", 401)',
    );
    expect(createHold).toContain("SUPABASE_SERVICE_ROLE_KEY");

    expect(releaseHold).toContain("verifySession(supabase, req)");
    expect(releaseHold).toContain(
      'if (!authId) return errorResponse("Unauthorized", 401)',
    );
    expect(releaseHold).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("persists stable client line item IDs before creating the atomic hold", () => {
    expect(createHold).toContain("lineItemId");
    expect(createHold).toContain("Duplicate lineItemId");
    expect(createHold).toContain("id: item.lineItemId");
    expect(createHold).toContain("cart_line_items");
  });

  it("delegates inventory reservation and release to database RPCs", () => {
    expect(createHold).toContain('"cart_create_hold"');
    expect(createHold).toContain("p_hold_seconds: 600");
    expect(createHold).toContain("insufficient_capacity");

    expect(releaseHold).toContain('"cart_release_hold"');
    expect(releaseHold).toContain("releasedCount");
  });

  it("prevents releasing or mutating another user's cart", () => {
    expect(createHold).toContain("existingCart.user_id !== authId");
    expect(releaseHold).toContain("cart.user_id !== authId");
    expect(releaseHold).toContain("Cart not found");
  });
});
