/**
 * Settings Sub-Screen Stack Layout
 *
 * Provides native Stack headers for all settings sub-screens.
 * - Dark theme with transparent headers
 * - Back button handled natively
 * - contentStyle transparent for liquid glass on iOS 26+
 */
import { Stack } from "expo-router/stack";

const HEADER_OPTS = {
  headerShown: true,
  headerBackButtonDisplayMode: "minimal" as const,
  headerTintColor: "#fff",
  headerStyle: { backgroundColor: "#000" },
  headerTitleStyle: {
    color: "#fff",
    fontFamily: "Inter-SemiBold",
    fontSize: 17,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: "#000" },
};

export default function SettingsLayout() {
  return (
    <Stack screenOptions={HEADER_OPTS}>
      {/* Main settings screen uses its own custom header */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* ─── Attendee Payment Screens ─── */}
      <Stack.Screen name="payments" options={{ title: "Payments" }} />
      <Stack.Screen
        name="payment-methods"
        options={{ title: "Payment Methods" }}
      />
      <Stack.Screen name="purchases" options={{ title: "Purchases" }} />
      <Stack.Screen
        name="receipts"
        options={{ title: "Receipts & Invoices" }}
      />
      <Stack.Screen name="refunds" options={{ title: "Refunds" }} />
      <Stack.Screen
        name="refund-request"
        options={{ title: "Request Refund" }}
      />
      <Stack.Screen name="receipt-viewer" options={{ title: "Receipt" }} />
      <Stack.Screen name="order/[id]" options={{ title: "Order Details" }} />

      {/* ─── Organizer / Host Screens ─── */}
      <Stack.Screen
        name="host-payments"
        options={{ title: "Organizer Payments" }}
      />
      <Stack.Screen name="host-payouts" options={{ title: "Payout History" }} />
      <Stack.Screen
        name="host-transactions"
        options={{ title: "Transactions" }}
      />
      <Stack.Screen name="host-disputes" options={{ title: "Disputes" }} />
      <Stack.Screen
        name="host-branding"
        options={{ title: "Receipt Branding" }}
      />

      {/* ─── General Settings Screens (own custom headers — hide Stack header) ─── */}
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="blocked" options={{ headerShown: false }} />
      <Stack.Screen name="close-friends" options={{ headerShown: false }} />
      <Stack.Screen name="messages" options={{ headerShown: false }} />
      <Stack.Screen name="likes-comments" options={{ headerShown: false }} />
      <Stack.Screen name="archived" options={{ headerShown: false }} />
      <Stack.Screen name="theme" options={{ headerShown: false }} />
      <Stack.Screen name="language" options={{ headerShown: false }} />
      <Stack.Screen name="weather-ambiance" options={{ headerShown: false }} />

      {/* ─── Info & Legal (own custom headers — hide Stack header) ─── */}
      <Stack.Screen name="about" options={{ headerShown: false }} />
      <Stack.Screen name="eligibility" options={{ headerShown: false }} />
      <Stack.Screen
        name="identity-protection"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen
        name="community-guidelines"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ad-policy" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
    </Stack>
  );
}
