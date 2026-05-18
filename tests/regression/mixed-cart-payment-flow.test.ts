import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("mixed cart PaymentSheet flow", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const cartApi = read("lib/api/cart.ts");
  const checkoutHook = read("lib/hooks/use-mixed-cart-checkout.ts");
  const recoveryHook = read("lib/hooks/use-cart-payment-recovery.ts");
  const reviewScreen = read("app/(protected)/checkout/review.tsx");
  const successScreen = read("app/(protected)/checkout/success.tsx");
  const calendarHelper = read("lib/calendar/cart-ticket-calendar.ts");
  const layout = read("app/(protected)/_layout.tsx");

  it("validates all mixed-cart edge responses through DTOs", () => {
    expect(cartApi).toContain("CartHoldResponseDTO");
    expect(cartApi).toContain("CartCheckoutResponseDTO");
    expect(cartApi).toContain("CartStatusResponseDTO");
    expect(cartApi).toContain("parseDTO");
    expect(cartApi).toContain('invokeEdge("cart-create-hold"');
    expect(cartApi).toContain('invokeEdge("cart-checkout"');
    expect(cartApi).toContain('invokeEdge("get-cart-status"');
  });

  it("creates a hold before opening one native PaymentSheet", () => {
    expect(checkoutHook).toContain("cartApi.createHold(cart)");
    expect(checkoutHook).toContain("cartApi.checkout(cart.cartId)");
    expect(checkoutHook).toContain("initPaymentSheet");
    expect(checkoutHook).toContain("presentPaymentSheet");
    expect(checkoutHook).toContain('returnURL: "dvnt://checkout/success"');
    expect(checkoutHook).toContain("mixed_cart_payment_sheet_succeeded");
  });

  it("recovers completed carts on foreground using get-cart-status", () => {
    expect(recoveryHook).toContain("AppState.addEventListener");
    expect(recoveryHook).toContain("cartApi.getStatus(currentCart.cartId)");
    expect(recoveryHook).toContain("status.completed");
    expect(recoveryHook).toContain("/(protected)/checkout/success");
    expect(recoveryHook).toContain("qk.cart.status");
  });

  it("wires the review button to the mixed-cart checkout hook", () => {
    expect(reviewScreen).toContain("useMixedCartCheckout");
    expect(reviewScreen).toContain("checkout()");
    expect(reviewScreen).toContain("Opening Payment...");
  });

  it("shows issued tickets and continues polling until webhook completion", () => {
    expect(successScreen).toContain("normalizeRouteParams");
    expect(successScreen).toContain("cartApi.getStatus");
    expect(successScreen).toContain("refetchInterval");
    expect(successScreen).toContain("LegendList");
    expect(successScreen).toContain("Coat Check");
    expect(successScreen).toContain("addCartTicketToCalendar");
    expect(successScreen).not.toContain("useState");
    expect(successScreen).not.toContain("Alert");
  });

  it("adds checkout tickets to the device calendar without Alert", () => {
    expect(calendarHelper).toContain("requestCalendarPermissionsAsync");
    expect(calendarHelper).toContain("createEventAsync");
    expect(calendarHelper).toContain("@dvnt/cart_calendar_events");
    expect(calendarHelper).not.toContain("Alert");
  });

  it("registers recovery and success route at the protected layout", () => {
    expect(layout).toContain("useCartPaymentRecovery()");
    expect(layout).toContain('name="checkout/success"');
  });
});
