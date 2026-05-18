import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("mixed cart frontend contracts", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const store = read("lib/stores/cart.ts");
  const dto = read("lib/contracts/dto.ts");
  const queryKeys = read("lib/query/keys.ts");
  const authClient = read("lib/auth-client.ts");
  const storage = read("lib/utils/storage.ts");

  it("keeps cart state in a persisted Zustand store", () => {
    expect(store).toContain("create<CartState>()");
    expect(store).toContain("persist(");
    expect(store).toContain('name: "cart-storage"');
    expect(store).toContain("mmkvStorage");
    expect(store).not.toContain("useState");
  });

  it("creates stable UUID cart and line-item identifiers", () => {
    expect(store).toContain('from "expo-crypto"');
    expect(store).toContain("Crypto.randomUUID()");
    expect(store).toContain("cartId: createUuid()");
    expect(store).toContain("idempotencyKey: createUuid()");
    expect(store).toContain("lineItemId: input.lineItemId ?? createUuid()");
  });

  it("records cart state transitions as Sentry breadcrumbs through AppTrace", () => {
    expect(store).toContain('AppTrace.trace("CART"');
    expect(store).toContain('"cart_started"');
    expect(store).toContain('"cart_hold_created"');
    expect(store).toContain('"cart_payment_intent_set"');
    expect(store).toContain('"cart_completed"');
  });

  it("clears cart persistence and store state on auth switch", () => {
    expect(storage).toContain('"cart-storage"');
    expect(authClient).toContain('require("@/lib/stores/cart")');
    expect(authClient).toContain("useCartStore.getState().reset()");
  });

  it("adds DTOs and raw query-key coverage for cart recovery", () => {
    expect(dto).toContain("CartLineItemDTO");
    expect(dto).toContain("CartDTO");
    expect(dto).toContain("CartStatusResponseDTO");
    expect(queryKeys).toContain("cart:");
    expect(queryKeys).toContain("byEventAndCategory");
  });
});
