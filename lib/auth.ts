/**
 * Better Auth Server Configuration
 *
 * This is the server-side auth configuration that runs in Expo API routes.
 * It connects to the existing Supabase Postgres database.
 *
 * Email delivery:
 *   All transactional email is sent via Resend (resend.com).
 *   Templates: welcome, confirm-email, reset-password.
 *   The Supabase Edge Function `send-email` is the canonical
 *   path for edge-triggered emails. This file handles emails
 *   that Better Auth triggers directly (reset, verify).
 *
 * Required env vars:
 *   RESEND_API_KEY       — Resend API token (re_...)
 *   DATABASE_URL         — Supabase Postgres connection string
 *   EXPO_PUBLIC_AUTH_URL — Better Auth server URL
 */

import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { expo } from "@better-auth/expo";
import { Pool } from "pg";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
// Use onboarding@resend.dev until dvnt.app domain is verified in Resend
// Once verified, switch to: DVNT <noreply@dvnt.app>
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "DVNT <onboarding@resend.dev>";
const APP_NAME = "DVNT";
const BRAND_COLOR = "#6366f1";

// ─── Reusable email helpers ──────────────────────────────────────────────────

function baseWrapper(content: string): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    "<body style=\"margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif\">",
    '<div style="max-width:480px;margin:0 auto;padding:40px 24px">',
    content,
    '<hr style="border:none;border-top:1px solid #27272a;margin:32px 0"/>',
    `<p style="color:#52525b;font-size:12px;text-align:center">${APP_NAME} &mdash; Where nightlife meets culture</p>`,
    "</div></body></html>",
  ].join("");
}

function ctaButton(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:${BRAND_COLOR};color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px">${text}</a>`;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(
      `[Auth:Email] ✓ Sent "${subject}" to ${to}, id: ${(result as any)?.data?.id || "unknown"}`,
    );
  } catch (err) {
    console.error(`[Auth:Email] ✗ Failed to send "${subject}" to ${to}:`, err);
    // Fail loudly in dev, soft fail in prod
    if (process.env.NODE_ENV === "development") throw err;
  }
}

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
    // Set to false for now — flip to true once dvnt.app domain is verified in Resend
    requireEmailVerification: false,
    // Password reset email (triggered by forgetPassword client call)
    sendResetPassword: async ({ user, url }) => {
      console.log(`[Auth] Password reset requested for ${user.email}`);
      const html = baseWrapper(
        [
          '<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Reset Your Password</h1>',
          '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">We received a request to reset your password. Tap the button below to choose a new one. This link expires in 1 hour.</p>',
          ctaButton("Reset Password", url),
          '<p style="color:#71717a;font-size:13px">If you didn\u2019t request this, you can safely ignore this email.</p>',
          `<p style="color:#3f3f46;font-size:12px;word-break:break-all">Or copy this link: ${url}</p>`,
        ].join(""),
      );
      await sendEmail(user.email, `Reset your ${APP_NAME} password`, html);
    },
    // Email verification (triggered when requireEmailVerification is true)
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: any;
      url: string;
    }) => {
      console.log(`[Auth] Email verification requested for ${user.email}`);
      const name = user.name || user.email.split("@")[0];
      const html = baseWrapper(
        [
          '<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Confirm Your Email</h1>',
          `<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Hey ${name},</p>`,
          '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Tap the button below to verify your email address. This link expires in 24 hours.</p>',
          ctaButton("Confirm Email", url),
          '<p style="color:#71717a;font-size:13px">If you didn\u2019t create an account, you can safely ignore this email.</p>',
          `<p style="color:#3f3f46;font-size:12px;word-break:break-all">Or copy this link: ${url}</p>`,
        ].join(""),
      );
      await sendEmail(user.email, `Confirm your ${APP_NAME} email`, html);
    },
  },

  // Database hooks — fire-and-forget side effects
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Welcome email — sent on every new signup
          console.log(
            `[Auth] New user created: ${user.email}, sending welcome email`,
          );
          const name = user.name || user.email.split("@")[0];
          const html = baseWrapper(
            [
              `<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Welcome to ${APP_NAME} 🎉</h1>`,
              `<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Hey ${name},</p>`,
              '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Your account is live. You\'re now part of the community where nightlife meets culture.</p>',
              '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Here\'s what you can do:</p>',
              '<ul style="color:#a1a1aa;line-height:2;font-size:15px;padding-left:20px">',
              "<li>Discover events happening near you</li>",
              "<li>Share stories and connect with your crew</li>",
              "<li>Get exclusive access to VIP experiences</li>",
              "</ul>",
              ctaButton("Open DVNT", "dvnt://"),
            ].join(""),
          );
          await sendEmail(user.email, `Welcome to ${APP_NAME}!`, html);
        },
      },
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
        process.env.EXPO_PUBLIC_AUTH_URL ||
        "https://server-zeta-lovat.vercel.app",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
    }),
  ],

  // Session configuration
  session: {
    // 7-day session, 1-day refresh window
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

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
