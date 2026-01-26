/**
 * Better Auth Server Configuration
 *
 * This file configures the Better Auth server instance.
 * Import ONLY in server-side code (+api.ts routes).
 */

import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const DATABASE_URI = process.env.DATABASE_URI;

if (!BETTER_AUTH_SECRET) {
  console.warn("[Auth] BETTER_AUTH_SECRET environment variable is not set");
}

if (!DATABASE_URI) {
  console.warn("[Auth] DATABASE_URI environment variable is not set");
}

export const auth = betterAuth({
  database: {
    provider: "pg",
    url: DATABASE_URI!,
  },
  secret: BETTER_AUTH_SECRET,
  baseURL:
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    "https://server-zeta-lovat.vercel.app",
  trustedOrigins: [
    "dvnt://",
    "dvnt://*",
    "exp+dvnt://",
    "exp+dvnt://*",
    "https://server-zeta-lovat.vercel.app",
    "https://payload-cms-setup-gray.vercel.app",
    // Development origins (safe - only affects local dev server)
    "http://localhost:8081",
    "http://localhost:3000",
  ],
  plugins: [expo()],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
      },
      avatar: {
        type: "string",
        required: false,
      },
      isVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || "",
      clientSecret: process.env.APPLE_CLIENT_SECRET || "",
      enabled: !!process.env.APPLE_CLIENT_ID,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
