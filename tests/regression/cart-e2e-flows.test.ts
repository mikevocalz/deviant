import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Mixed-cart Maestro E2E flow definitions", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  const admissionOnly = read(".maestro/cart-admission-only.yaml");
  const mixedPurchase = read(".maestro/cart-mixed-purchase.yaml");
  const removeMidCheckout = read(".maestro/cart-remove-mid-checkout.yaml");

  it("covers admission-only checkout through Apple Pay and success", () => {
    expect(admissionOnly).toContain("Cart admission-only checkout");
    expect(admissionOnly).toContain("General Admission");
    expect(admissionOnly).toContain("Continue to Payment");
    expect(admissionOnly).toContain("Apple Pay");
    expect(admissionOnly).toContain("Tickets Ready");
  });

  it("covers one mixed admission plus coat-check purchase", () => {
    expect(mixedPurchase).toContain(
      "Cart mixed admission and coat-check purchase",
    );
    expect(mixedPurchase).toContain("Coat Check");
    expect(mixedPurchase).toContain("Admission ticket");
    expect(mixedPurchase).toContain("Claim pass");
    expect(mixedPurchase).toContain("Add to Calendar");
  });

  it("covers removing coat-check before completing admission-only payment", () => {
    expect(removeMidCheckout).toContain(
      "Cart remove coat-check before payment",
    );
    expect(removeMidCheckout).toContain("Remove Coat Check");
    expect(removeMidCheckout).toContain('assertNotVisible: "Coat Check"');
    expect(removeMidCheckout).toContain("Admission ticket");
  });
});
