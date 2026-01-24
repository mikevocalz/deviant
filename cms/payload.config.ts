/**
 * Payload CMS Configuration
 *
 * Deploy this configuration to your Payload CMS instance.
 * Update the database adapter and other settings as needed.
 */

import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { fileURLToPath } from "url";

import { Posts } from "./collections/Posts";
import { Users } from "./collections/Users";
import { Events } from "./collections/Events";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: "- Deviant CMS",
    },
  },
  collections: [Users, Posts, Events],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "your-secret-key",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
  }),
  cors: [
    "http://localhost:8081",
    "http://localhost:3000",
    process.env.EXPO_PUBLIC_API_URL,
    "dvnt://",
  ].filter(Boolean) as string[],
  csrf: [
    "http://localhost:8081",
    "http://localhost:3000",
    process.env.EXPO_PUBLIC_API_URL,
    "dvnt://",
  ].filter(Boolean) as string[],
});
