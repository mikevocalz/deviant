/**
 * Shared helper: validate and apply a promo code to a ticket purchase.
 *
 * Returns the validated promo and discount amount, or null if invalid.
 * Does NOT increment uses_count — caller must do that after successful payment.
 */

export interface PromoResult {
  promo_code_id: string;
  discount_type: "percent" | "fixed_cents";
  discount_value: number;
  discount_cents: number;
  code: string;
}

/**
 * Validate a promo code and compute the discount for a given subtotal.
 */
export async function validateAndApplyPromo(
  supabase: any,
  eventId: number,
  code: string,
  ticketTypeId: string | null,
  subtotalCents: number,
): Promise<{ result: PromoResult | null; error: string | null }> {
  if (!code || !code.trim()) {
    return { result: null, error: null }; // No code provided — not an error
  }

  const normalizedCode = code.trim().toUpperCase();

  const { data: promos, error: promoError } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("event_id", eventId)
    .ilike("code", normalizedCode);

  if (promoError || !promos?.length) {
    return { result: null, error: "Invalid promo code" };
  }

  // Prefer ticket-type-scoped match, then event-wide (ticket_type_id IS NULL)
  let promo = promos.find(
    (p: any) => p.ticket_type_id === ticketTypeId,
  );
  if (!promo) {
    promo = promos.find((p: any) => !p.ticket_type_id);
  }
  if (!promo) {
    return { result: null, error: "Promo code not valid for this ticket type" };
  }

  // Time window
  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return { result: null, error: "Promo code is not yet active" };
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { result: null, error: "Promo code has expired" };
  }

  // Max uses
  if (promo.max_uses && promo.uses_count >= promo.max_uses) {
    return { result: null, error: "Promo code has been fully redeemed" };
  }

  // Compute discount
  let discountCents: number;
  if (promo.discount_type === "percent") {
    discountCents = Math.round(subtotalCents * (promo.discount_value / 100));
  } else {
    // fixed_cents
    discountCents = promo.discount_value;
  }

  // Never discount more than the subtotal
  discountCents = Math.min(discountCents, subtotalCents);

  return {
    result: {
      promo_code_id: promo.id,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_cents: discountCents,
      code: promo.code,
    },
    error: null,
  };
}

/**
 * Increment the uses_count on a promo code after successful redemption.
 */
export async function incrementPromoUsage(
  supabase: any,
  promoCodeId: string,
): Promise<void> {
  await supabase.rpc("increment_promo_uses", { p_promo_id: promoCodeId });
}
