/**
 * Edge Function: auth
 *
 * Better Auth handler — the ONLY auth server for the DVNT app.
 * Handles: sign-in, sign-up, sign-out, session, reset-password, verify-email.
 *
 * Required Deno env vars (set via `supabase secrets set`):
 *   DATABASE_URL          — Supabase Postgres connection string
 *   BETTER_AUTH_SECRET    — Secret for signing sessions/tokens
 *   RESEND_API_KEY        — Resend API token (re_...)
 *   RESEND_FROM_EMAIL     — Verified sender (e.g. DVNT <noreply@dvnt.app>)
 */

// ─── Env ────────────────────────────────────────────────────────────────────
const DATABASE_URL = Deno.env.get("DATABASE_URL") || "";
const BETTER_AUTH_SECRET = Deno.env.get("BETTER_AUTH_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") || "DVNT <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const AUTH_BASE_URL = SUPABASE_URL; // Just the origin — no path component!
const APP_NAME = "DVNT";
const BRAND_COLOR = "#6366f1";

console.log("[Auth] Starting edge function...");
console.log("[Auth] DATABASE_URL:", DATABASE_URL ? "SET" : "MISSING");
console.log(
  "[Auth] BETTER_AUTH_SECRET:",
  BETTER_AUTH_SECRET ? "SET" : "MISSING",
);
console.log("[Auth] AUTH_BASE_URL:", AUTH_BASE_URL);

// ─── CORS ───────────────────────────────────────────────────────────────────
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cookie, set-cookie",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Expose-Headers": "set-auth-token, set-cookie",
};

// ─── Email helpers ──────────────────────────────────────────────────────────
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
  if (!RESEND_API_KEY) {
    console.error("[Auth:Email] RESEND_API_KEY not set, skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[Auth:Email] Resend error ${res.status}:`, data);
    } else {
      console.log(
        `[Auth:Email] ✓ Sent "${subject}" to ${to}, id: ${data?.id || "unknown"}`,
      );
    }
  } catch (err) {
    console.error(`[Auth:Email] ✗ Failed "${subject}" to ${to}:`, err);
  }
}

// ─── Lazy-load Better Auth (deferred so startup doesn't crash) ──────────────
let _auth: any = null;
let _initError: string | null = null;

async function getAuth() {
  if (_auth) return _auth;
  if (_initError) throw new Error(_initError);

  try {
    console.log("[Auth] Initializing Better Auth...");

    // Import Better Auth + plugins
    const { betterAuth } = await import("npm:better-auth@1.2.7");
    const { expo } = await import("npm:@better-auth/expo@1.2.7");
    const { username } = await import("npm:better-auth@1.2.7/plugins");
    const { passkey } = await import("npm:@better-auth/passkey@1.2.7");

    // Import npm:pg — Deno supports Node built-ins (node:net, node:tls) needed by pg
    const pgModule = await import("npm:pg@8.13.1");
    const Pool = pgModule.Pool || pgModule.default?.Pool || pgModule.default;
    console.log("[Auth] All modules loaded, Pool type:", typeof Pool);

    // Use SUPABASE_DB_URL (internal connection, supports TCP from within Supabase infra)
    // Falls back to DATABASE_URL (external pooler connection)
    const dbUrl = Deno.env.get("SUPABASE_DB_URL") || DATABASE_URL;
    console.log("[Auth] DB URL length:", dbUrl.length);

    // Create a real pg.Pool instance — Better Auth recognizes this via instanceof
    const pool = new Pool({
      connectionString: dbUrl,
      max: 2,
      ssl: dbUrl.includes("sslmode=")
        ? undefined
        : { rejectUnauthorized: false },
    });

    // Test the connection immediately
    const testClient = await pool.connect();
    const testResult = await testClient.query("SELECT 1 as ok");
    testClient.release();
    console.log("[Auth] DB connection verified:", testResult.rows[0]);

    _auth = betterAuth({
      database: pool,
      secret: BETTER_AUTH_SECRET,
      baseURL: AUTH_BASE_URL, // Just origin, no path — basePath controls route prefix
      basePath: "/api/auth",
      trustedOrigins: [
        "dvnt://",
        "dvnt://*",
        "exp+dvnt://",
        "exp+dvnt://*",
        "exp://",
        "http://localhost:8081",
        AUTH_BASE_URL,
      ],
      plugins: [expo(), username(), passkey()],
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        requireEmailVerification: false,
        sendResetPassword: async ({
          user,
          url,
        }: {
          user: any;
          url: string;
        }) => {
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
      databaseHooks: {
        user: {
          create: {
            after: async (user: any) => {
              console.log(
                `[Auth] New user created: ${user.email}, sending welcome email`,
              );
              const name = user.name || user.email.split("@")[0];
              const html = baseWrapper(
                [
                  `<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Welcome to ${APP_NAME} 🎉</h1>`,
                  `<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Hey ${name},</p>`,
                  '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Your account is live. You\'re now part of the community where nightlife meets culture.</p>',
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
      user: {
        additionalFields: {
          username: { type: "string", required: false, input: true },
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
          bio: { type: "string", required: false, input: true },
          location: { type: "string", required: false, input: true },
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
      session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
      },
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ["google", "apple"],
        },
      },
    });

    console.log("[Auth] Better Auth initialized successfully");
    return _auth;
  } catch (err: any) {
    _initError = err.message || "Unknown init error";
    console.error("[Auth] INIT FAILED:", err);
    throw err;
  }
}

// ─── Deno.serve handler ─────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Health check (lightweight, no DB init)
  if (path === "/auth" || path === "/auth/health") {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "dvnt-auth",
        initialized: !!_auth,
        initError: _initError,
        database: DATABASE_URL ? "configured" : "MISSING",
        secret: BETTER_AUTH_SECRET ? "configured" : "MISSING",
        resend: RESEND_API_KEY ? "configured" : "MISSING",
        baseUrl: AUTH_BASE_URL,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // All other requests → Better Auth
  try {
    const auth = await getAuth();

    // URL rewriting: Supabase sends http://domain/auth/api/auth/sign-in/email
    // Strip /auth prefix → /api/auth/sign-in/email
    // Construct https://domain/api/auth/sign-in/email (matching basePath)
    const strippedPath = path.replace(/^\/auth/, "") || "/";
    const rewrittenUrl = `${AUTH_BASE_URL}${strippedPath}${url.search}`;

    console.log("[Auth]", req.method, path, "→", strippedPath);

    const authRequest = new Request(rewrittenUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : null,
    });

    const response = await auth.handler(authRequest);

    // Merge CORS headers into response
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error("[Auth] Handler error:", error);
    return new Response(
      JSON.stringify({
        error: "Auth service error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
