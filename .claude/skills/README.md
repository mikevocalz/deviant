# Claude Code Skills

This directory holds project-scoped Claude Code skills. These are
auto-loaded for everyone working in this repo — no per-user install.

## What's in here (already installed, committed)

### `frontend-design/`
Anthropic's frontend-design skill. Generates distinctive, production-grade
UI code instead of generic AI-looking interfaces. Use when asking Claude
to build screens / components / artifacts.
Source: https://github.com/anthropics/skills/tree/main/skills/frontend-design

### `stripe-best-practices/`
Stripe's integration-decision routing skill. Routes between Checkout
Sessions vs PaymentIntents, Connect setup, webhook handling, etc.
Includes `references/` for payments, connect, billing, security, treasury.
Use when touching DVNT's ticket checkout / payout flows.
Source: https://github.com/stripe/ai/tree/main/skills/stripe-best-practices

## Additional skills worth installing (plugin-marketplace, per-user)

These are published as Claude Code marketplace plugins. I can't
programmatically install them — each developer runs the slash commands
below once, and the plugin is available across every project for that
user. Skip the XR / Next.js / Three.js packages — not relevant to DVNT.

Paste these into Claude Code one at a time:

```
/plugin marketplace add expo/skills
/plugin install expo@expo

/plugin marketplace add software-mansion-labs/skills
/plugin install skills@swmansion

/plugin marketplace add callstackincubator/agent-skills
/plugin install react-native-best-practices@callstack-agent-skills
/plugin install upgrading-react-native@callstack-agent-skills

/plugin marketplace add supabase/agent-skills
/plugin install supabase@supabase-agent-skills
/plugin install postgres-best-practices@supabase-agent-skills

/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills

/reload-plugins
```

What each one covers (relative to DVNT's stack):

- **expo/skills** → EAS Update insights, expo-dev-client, expo-ui on
  Jetpack Compose + SwiftUI, upgrading Expo, native-data-fetching,
  CI/CD workflows. Directly relevant to the TestFlight / EAS workflow
  in `DEPLOY.md`.
- **software-mansion-labs/skills** → React Native, Reanimated,
  Gesture Handler, Expo (Software Mansion maintains most of these
  libraries). Matches every animation + gesture surface in the app.
- **callstackincubator/agent-skills** → React Native best practices,
  RN upgrade paths. Callstack ships RN infrastructure.
- **supabase/agent-skills** → Supabase + Postgres best practices.
  Every Edge Function + migration in `supabase/` benefits.
- **anthropics/skills/document-skills** → PDF / DOCX / PPTX / XLSX
  handling. Useful for generating tickets, CSV exports, reports.

## MCP servers (not skills — but useful for physical-device testing)

Skills give Claude prompt-level context. MCP servers give Claude
real tools (tap a device, run a shell command, query a DB).

Only one is worth installing right now for DVNT: `mobile-mcp`. It
drives an iOS simulator or physical Android device. Must run on the
Mac where Xcode lives — not a sandboxed Claude session.

```bash
claude mcp add mobile-mcp -- npx -y @mobilenext/mobile-mcp@latest
```

Source: https://github.com/mobile-next/mobile-mcp

Restart Claude Code after install. Device tools will appear under
`mcp__mobile__*`.

## Skills that don't exist (for the record)

- `expo-app-design` — not a real published skill. No repo matches.
  The Anthropic `frontend-design` skill (installed above) is the
  closest substitute.
- `expo-mcp` — no official Expo MCP server exists at time of writing.
  The `expo-cli` is callable via regular Bash — no wrapper needed.

## Adding a new project skill

```
.claude/skills/my-skill/
  SKILL.md        # YAML frontmatter + instructions
  references/…    # optional
```

Frontmatter must include `name` and `description`. Example — see
`stripe-best-practices/SKILL.md`.
