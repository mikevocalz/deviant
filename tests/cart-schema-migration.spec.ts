import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Mixed-cart schema migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260516150000_mixed_cart_checkout.sql",
    ),
    "utf8",
  );

  it("creates the cart tables needed for mixed checkout", () => {
    expect(migration).toContain("create table if not exists public.carts");
    expect(migration).toContain(
      "create table if not exists public.cart_line_items",
    );
    expect(migration).toContain("create table if not exists public.cart_holds");
    expect(migration).toContain(
      "create table if not exists public.cart_line_refunds",
    );
  });

  it("links issued tickets back to their cart line item", () => {
    expect(migration).toContain("add column if not exists cart_id uuid");
    expect(migration).toContain(
      "add column if not exists cart_line_item_id uuid",
    );
    expect(migration).toContain("tickets_cart_line_item_id_fkey");
    expect(migration).toContain("idx_tickets_cart_line_item");
  });

  it("keeps inventory holds behind atomic database RPCs", () => {
    expect(migration).toContain("function public.cart_create_hold");
    expect(migration).toContain("for update of cli, tt");
    expect(migration).toContain("insufficient_capacity");
    expect(migration).toContain("function public.cart_release_hold");
    expect(migration).toContain("function public.cart_release_expired_holds");
    expect(migration).toContain("function public.cart_complete_issuance");
  });

  it("keeps cart writes service-role only with owner-scoped reads", () => {
    expect(migration).toContain("grant all on public.carts to service_role");
    expect(migration).toContain(
      "grant select on public.carts to authenticated",
    );
    expect(migration).toContain("revoke all on public.carts from anon");
    expect(migration).toContain("create policy carts_select_owner");
  });
});
