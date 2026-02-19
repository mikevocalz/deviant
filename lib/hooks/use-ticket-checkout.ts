/**
 * useTicketCheckout — Native Stripe PaymentSheet hook
 *
 * Replaces the browser-redirect Stripe Checkout flow with
 * an in-app native payment sheet for a seamless UX.
 *
 * Falls back to Stripe Checkout (browser redirect) if PaymentSheet
 * initialization fails for any reason.
 */

import { useState, useCallback } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "@/lib/supabase/client";
import { useUIStore } from "@/lib/stores/ui-store";

interface CheckoutParams {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  userId: string;
}

interface CheckoutResult {
  success: boolean;
  free?: boolean;
  tickets?: Array<{ id: string; qr_token: string }>;
  error?: string;
  paymentIntentId?: string;
}

export function useTicketCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const showToast = useUIStore((s) => s.showToast);
  const [isLoading, setIsLoading] = useState(false);

  const checkout = useCallback(
    async (params: CheckoutParams): Promise<CheckoutResult> => {
      const { eventId, ticketTypeId, quantity, userId } = params;
      setIsLoading(true);

      try {
        // Step 1: Create PaymentIntent via edge function
        const { data, error } = await supabase.functions.invoke(
          "create-payment-intent",
          {
            body: {
              event_id: eventId,
              ticket_type_id: ticketTypeId,
              quantity,
              user_id: userId,
            },
          },
        );

        if (error) throw new Error(error.message || "Failed to create payment");

        const result = typeof data === "string" ? JSON.parse(data) : data;

        if (result.error) throw new Error(result.error);

        // Free ticket — already issued server-side
        if (result.free && result.tickets) {
          return { success: true, free: true, tickets: result.tickets };
        }

        // Step 2: Initialize native PaymentSheet
        const { paymentIntent, ephemeralKey, customer, publishableKey } = result;

        if (!paymentIntent || !ephemeralKey || !customer) {
          throw new Error("Missing PaymentSheet parameters from server");
        }

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "DVNT",
          customerId: customer,
          customerEphemeralKeySecret: ephemeralKey,
          paymentIntentClientSecret: paymentIntent,
          allowsDelayedPaymentMethods: false,
          defaultBillingDetails: { name: "" },
          appearance: {
            colors: {
              primary: "#8A40CF",
              background: "#1a1a1a",
              componentBackground: "#262626",
              componentText: "#ffffff",
              secondaryText: "#a1a1aa",
              placeholderText: "#71717a",
              icon: "#8A40CF",
            },
            shapes: {
              borderRadius: 12,
              borderWidth: 1,
            },
          },
          returnURL: "dvnt://tickets/success",
        });

        if (initError) {
          console.error("[useTicketCheckout] initPaymentSheet error:", initError);
          throw new Error(initError.message || "Failed to initialize payment");
        }

        // Step 3: Present PaymentSheet to user
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          // User cancelled — not a real error
          if (presentError.code === "Canceled") {
            return { success: false, error: "Payment cancelled" };
          }
          console.error(
            "[useTicketCheckout] presentPaymentSheet error:",
            presentError,
          );
          throw new Error(presentError.message || "Payment failed");
        }

        // Step 4: Payment succeeded (webhook will finalize tickets)
        return {
          success: true,
          paymentIntentId: result.paymentIntentId,
        };
      } catch (err: any) {
        console.error("[useTicketCheckout] Error:", err);
        return { success: false, error: err.message || "Checkout failed" };
      } finally {
        setIsLoading(false);
      }
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  return { checkout, isLoading };
}
