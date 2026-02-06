/**
 * Better Auth Server Configuration
 *
 * This is the server-side auth configuration that runs in Expo API routes.
 * It connects to the existing Supabase Postgres database.
 */

import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { expo } from "@better-auth/expo";
import { Pool } from "pg";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "DVNT <noreply@dvnt.app>";

// Database connection - uses Supabase Postgres
const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(
    "https://",
    "postgresql://postgres:postgres@",
  ).replace(".supabase.co", ".supabase.co:5432/postgres");

export const auth = betterAuth({
  database: new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),

  // App scheme for deep linking
  trustedOrigins: ["dvnt://", "dvnt://*", "exp://"],
  // socialProviders: {
  //     google: {
  //       clientId: process.env.GOOGLE_CLIENT_ID!,
  //       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  //     },
  //     apple: {
  //       clientId: process.env.APPLE_CLIENT_ID!,       // Apple Service ID (web) or configured per-platform
  //       clientSecret: process.env.APPLE_CLIENT_SECRET!,
  //     },
  //   },
  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[Auth] Password reset requested for ${user.email}`);
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: "Reset your DVNT password",
          html: [
            '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:16px">',
            '<h2 style="margin:0 0 16px">Reset Your Password</h2>',
            '<p style="color:#a1a1aa;line-height:1.6">We received a request to reset your password. Tap the button below to choose a new one.</p>',
            `<a href="${url}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Reset Password</a>`,
            '<p style="color:#71717a;font-size:13px">If you didn\u2019t request this, you can safely ignore this email.</p>',
            '<hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>',
            '<p style="color:#52525b;font-size:12px">DVNT</p>',
            "</div>",
          ].join(""),
        });
        console.log(`[Auth] Reset email sent to ${user.email}`);
      } catch (err) {
        console.error("[Auth] Failed to send reset email:", err);
      }
    },
  },

  // Plugins
  plugins: [
    expo(),
    username(),
    passkey({
      rpID: "dvnt.app",
      rpName: "DVNT",
      origin:
        process.env.EXPO_PUBLIC_AUTH_URL || "https://dvnt-auth-new.vercel.app",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
    }),
  ],

  // Account linking configuration
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "apple"],
    },
  },

  // User configuration
  user: {
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: true,
      },
      firstName: {
        type: "string",
        required: false,
        input: true,
        fieldName: "first_name",
      },
      lastName: {
        type: "string",
        required: false,
        input: true,
        fieldName: "last_name",
      },
      bio: {
        type: "string",
        required: false,
        input: true,
      },
      location: {
        type: "string",
        required: false,
        input: true,
      },
      avatarId: {
        type: "number",
        required: false,
        input: false,
        fieldName: "avatar_id",
      },
      verified: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
      followersCount: {
        type: "number",
        required: false,
        input: false,
        fieldName: "followers_count",
        defaultValue: 0,
      },
      followingCount: {
        type: "number",
        required: false,
        input: false,
        fieldName: "following_count",
        defaultValue: 0,
      },
      postsCount: {
        type: "number",
        required: false,
        input: false,
        fieldName: "posts_count",
        defaultValue: 0,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
