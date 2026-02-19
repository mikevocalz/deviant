/**
 * Safe native module imports — gracefully degrade when native modules
 * are not available in the current binary.
 *
 * This prevents OTA updates from crashing on older native builds
 * that don't include these modules.
 */
import React from "react";

// ── Stripe ──────────────────────────────────────────────────────────
let _StripeProvider: React.ComponentType<any> | null = null;
try {
  _StripeProvider = require("@stripe/stripe-react-native").StripeProvider;
} catch (e) {
  console.warn(
    "[SafeModules] @stripe/stripe-react-native not available in this binary",
  );
}

export const SafeStripeProvider: React.ComponentType<any> = _StripeProvider
  ? _StripeProvider
  : ({ children }: any) => <>{children}</>;

// ── expo-share-intent ───────────────────────────────────────────────
type ShareIntentResult = {
  hasShareIntent: boolean;
  shareIntent: any;
  resetShareIntent: () => void;
};

let _useShareIntent: (() => ShareIntentResult) | null = null;
try {
  _useShareIntent = require("expo-share-intent").useShareIntent;
} catch (e) {
  console.warn("[SafeModules] expo-share-intent not available in this binary");
}

const noopShareIntent: ShareIntentResult = {
  hasShareIntent: false,
  shareIntent: null,
  resetShareIntent: () => {},
};

export const useShareIntentSafe: () => ShareIntentResult = _useShareIntent
  ? _useShareIntent
  : () => noopShareIntent;

// ── useStripe (also from @stripe/stripe-react-native) ───────────────
let _useStripe: any = null;
try {
  _useStripe = require("@stripe/stripe-react-native").useStripe;
} catch {
  // Already warned above
}

const noopStripe = {
  initPaymentSheet: async () => ({
    error: { message: "Stripe not available" },
  }),
  presentPaymentSheet: async () => ({
    error: { message: "Stripe not available" },
  }),
  confirmPaymentSheetPayment: async () => ({
    error: { message: "Stripe not available" },
  }),
};

export const useStripeSafe = _useStripe ? _useStripe : () => noopStripe;

// ── expo-calendar ───────────────────────────────────────────────────
let _ExpoCalendar: any = null;
try {
  _ExpoCalendar = require("expo-calendar");
} catch {
  console.warn("[SafeModules] expo-calendar not available in this binary");
}

export const SafeCalendar = _ExpoCalendar;

// ── expo-print ──────────────────────────────────────────────────────
let _ExpoPrint: any = null;
try {
  _ExpoPrint = require("expo-print");
} catch {
  console.warn("[SafeModules] expo-print not available in this binary");
}

export const SafePrint = _ExpoPrint;
