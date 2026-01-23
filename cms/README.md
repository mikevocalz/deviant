# Deviant CMS - Payload Configuration

Deploy these collection configurations to your Payload CMS instance.

## Quick Setup

### 1. Copy Collections to Your Payload CMS

```bash
# In your Payload CMS project
cp -r collections/ src/collections/
cp payload.config.ts src/payload.config.ts
```

### 2. Install Dependencies

```bash
pnpm add payload @payloadcms/db-postgres @payloadcms/richtext-lexical
```

### 3. Environment Variables

```env
DATABASE_URI=postgresql://user:password@host:5432/deviant
PAYLOAD_SECRET=your-secret-key-min-32-chars
```

### 4. Run Migrations

```bash
pnpm payload migrate:create
pnpm payload migrate
```

---

## Collections Overview

### Posts Collection

Stores user posts with media (images/videos).

**Key Fields:**

- `author` - Relationship to Users
- `media` - Array of `{ type: 'image' | 'video', url: string }`
- `caption` - Post text (max 2200 chars)
- `location` - Location name
- `isNSFW` - Adult content flag
- `likes`, `commentsCount`, `sharesCount` - Engagement metrics

**Example POST Request:**

```json
{
  "author": "user_id_here",
  "media": [
    {
      "type": "image",
      "url": "https://your-cdn.b-cdn.net/posts/2026/01/20/image.jpg"
    }
  ],
  "caption": "My first post!",
  "location": "New York, NY",
  "isNSFW": false
}
```

### Users Collection

User accounts with authentication.

**Key Fields:**

- `username` - Unique, lowercase
- `email` - Auth email
- `name` - Display name
- `avatar` - Profile picture URL
- `bio` - User bio (max 500 chars)
- `isVerified` - Verified badge
- `role` - user | creator | moderator | admin

---

## API Endpoints

Once deployed, your Payload CMS exposes these endpoints:

| Method | Endpoint         | Description     |
| ------ | ---------------- | --------------- |
| GET    | `/api/posts`     | List posts      |
| GET    | `/api/posts/:id` | Get single post |
| POST   | `/api/posts`     | Create post     |
| PATCH  | `/api/posts/:id` | Update post     |
| DELETE | `/api/posts/:id` | Delete post     |
| GET    | `/api/users`     | List users      |
| GET    | `/api/users/:id` | Get user        |
| GET    | `/api/users/me`  | Current user    |

---

## Troubleshooting

### Media Not Showing

1. Check that `media` field is an array in the CMS
2. Verify URLs are valid Bunny CDN URLs
3. Check CORS settings allow your app domain

### Posts Not Creating

1. Ensure user is authenticated (JWT token)
2. Check `author` field is a valid user ID
3. Verify API key has write permissions

---

## Deployment Options

- **Vercel**: `npx payload deploy`
- **Railway**: Connect repo, set env vars
- **Render**: Docker deployment
- **Self-hosted**: Node.js server

See [Payload CMS Deployment Docs](https://payloadcms.com/docs/production/deployment)
