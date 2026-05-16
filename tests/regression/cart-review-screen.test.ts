import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("mixed cart review screen", () => {
  const source = readFileSync(
    join(process.cwd(), "app/(protected)/checkout/review.tsx"),
    "utf8",
  );
  const layout = readFileSync(
    join(process.cwd(), "app/(protected)/_layout.tsx"),
    "utf8",
  );

  it("uses the persisted cart store and no banned local state/list patterns", () => {
    expect(source).toContain("useCartStore");
    expect(source).toContain("LegendList");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("FlatList");
    expect(source).not.toContain("FlashList");
    expect(source).not.toContain("Alert");
  });

  it("groups admission and coat-check line items by category", () => {
    expect(source).toContain(
      'const categories: LineItemCategory[] = ["admission", "coat_check"]',
    );
    expect(source).toContain("CATEGORY_LABELS");
    expect(source).toContain("Coat Check");
    expect(source).toContain("categoryIcon");
  });

  it("supports per-line quantity changes and removal", () => {
    expect(source).toContain("updateLineItemQuantity");
    expect(source).toContain("removeLineItem");
    expect(source).toContain("handleIncrement");
    expect(source).toContain("handleDecrement");
    expect(source).toContain("handleRemove");
  });

  it("renders a cents-only total breakdown with the canonical fee calculator", () => {
    expect(source).toContain("calculateCartSubtotalCents");
    expect(source).toContain("computeFees");
    expect(source).toContain("DVNT Service Fee");
    expect(source).toContain("Total");
  });

  it("registers the checkout review route in the protected stack", () => {
    expect(layout).toContain('name="checkout/review"');
  });
});
