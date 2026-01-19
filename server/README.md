# DVNT API Server

Standalone API server for DVNT mobile app. This server handles all API routes for production deployment.

## Why a Separate Server?

Expo Router's web export with `output: "server"` cannot bundle native React Native modules for SSR. Since the DVNT app uses many native modules (expo-secure-store, expo-notifications, react-native-vision-camera, etc.), the web export fails.

This standalone server provides the same API endpoints without any React Native dependencies.

## Setup

```bash
cd server
npm install
```

## Environment Variables

Create a `.env` file in the server directory:

```bash
PORT=3001
PAYLOAD_URL=https://your-payload-cms.vercel.app
PAYLOAD_API_KEY=your_api_key
BETTER_AUTH_SECRET=your_secret
DATABASE_URI=postgresql://...
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Deployment

### Deploy to Vercel

```bash
vercel deploy
```

### Deploy to Railway/Render/Fly.io

Use the standard Node.js deployment process.

## API Endpoints

- `GET /api/posts` - List posts
- `GET /api/posts/:id` - Get single post
- `POST /api/posts` - Create post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `GET /api/stories` - List stories
- `POST /api/stories` - Create story
- `GET /api/users` - List users
- `GET /api/users/me` - Get current user
- `GET /api/users/:id` - Get user by ID
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event by ID
- `POST /api/events` - Create event
- `GET /api/comments` - List comments (filter by postId)
- `POST /api/comments` - Create comment
- `POST /api/push-token` - Register push token

## Mobile App Configuration

Set the `EXPO_PUBLIC_API_URL` environment variable in your mobile app to point to this server:

```bash
# For EAS builds
EXPO_PUBLIC_API_URL=https://your-api-server.vercel.app
```
