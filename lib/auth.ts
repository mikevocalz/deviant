/**
 * Better Auth Server Configuration
 * 
 * This is the server-side auth configuration that runs in Expo API routes.
 * It connects to the existing Supabase Postgres database.
 */

import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { Pool } from "pg";

// Database connection - uses Supabase Postgres
const DATABASE_URL = process.env.DATABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(
  "https://",
  "postgresql://postgres:postgres@"
).replace(".supabase.co", ".supabase.co:5432/postgres");

export const auth = betterAuth({
  database: new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
  
  // App scheme for deep linking
  trustedOrigins: ["dvnt://", "dvnt://*", "exp://"],
  
  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  
  // Expo plugin for mobile auth
  plugins: [expo()],
  
  // User additional fields to match existing Supabase users table
  user: {
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
