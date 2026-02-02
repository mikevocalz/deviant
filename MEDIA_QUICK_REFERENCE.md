# Media Pipeline - Quick Reference

## 🚀 Common Operations

### Avatar Upload
```typescript
import { pickAndUploadImage } from '@/lib/media';

const media = await pickAndUploadImage('avatar', (p) => 
  console.log(`${Math.round(p * 100)}%`)
);
// Result: 512x512 WebP, ~50-150KB
```

### Feed Image Upload
```typescript
import { pickAndUploadImage } from '@/lib/media';

const media = await pickAndUploadImage('feed', (p) => 
  console.log(`${Math.round(p * 100)}%`)
);
// Result: ≤1280px WebP, ~200-800KB
```

### Story Video Upload
```typescript
import { pickAndUploadVideo } from '@/lib/media';

try {
  const media = await pickAndUploadVideo('story', (p) => 
    console.log(`${Math.round(p * 100)}%`)
  );
  // Result: ≤60s, ≤1080p MP4, ~5-15MB
} catch (error) {
  // Handle validation errors
  alert(error.message);
}
```

### Multiple Images
```typescript
import { pickAndUploadMultipleImages } from '@/lib/media';

const mediaList = await pickAndUploadMultipleImages(
  'feed',
  10, // max count
  (index, progress) => console.log(`Image ${index + 1}: ${progress}`)
);
// Result: Array of UploadedMedia
```

---

## 📏 Size Constraints

| Use Case | Max Size | Max Resolution | Format | Compression |
|----------|----------|----------------|--------|-------------|
| Avatar   | 2MB      | 512x512        | WebP   | 0.75        |
| Feed     | 5MB      | 1280x1280      | WebP   | 0.70        |
| Story    | 30MB     | 1080x1920      | MP4    | 0.70        |
| Message  | 10MB     | 1280x1280      | WebP   | 0.65        |

### Video Constraints
- **Duration**: ≤60 seconds
- **Frame Rate**: 30 fps
- **Codec**: H.264 only
- **Bitrate**: ~2-4 Mbps (automatic)

---

## 🗂️ Storage Structure

```
/avatars/
  /{userId}/2026/02/uuid.webp

/images/
  /{userId}/2026/02/uuid.webp

/videos/
  /{userId}/2026/02/uuid.mp4

/stories/
  /{userId}/2026/02/uuid.mp4  (expires: 24h)

/temp/
  /{userId}/uuid.webp         (expires: 1h)
```

---

## 🔍 Database Queries

### Get User's Media
```sql
SELECT * FROM media
WHERE owner_id = {userId}
ORDER BY created_at DESC
LIMIT 20;
```

### Check Storage Usage
```sql
SELECT 
  bucket_name,
  COUNT(*) as files,
  SUM(size_bytes) / 1024 / 1024 as mb
FROM media
WHERE owner_id = {userId}
GROUP BY bucket_name;
```

### Find Duplicates
```sql
SELECT hash, COUNT(*), SUM(size_bytes)
FROM media
GROUP BY hash
HAVING COUNT(*) > 1;
```

---

## 🛠️ Troubleshooting

### Error: "Image too large"
```typescript
// Reduce quality
const media = await processImage(uri, {
  ...MEDIA_CONSTRAINTS.feed,
  compressionQuality: 0.6, // Lower = smaller
});
```

### Error: "Video too long"
```typescript
// User must trim video
// Show error with max duration
alert(`Video too long! Max ${constraints.maxDurationSeconds}s`);
```

### Error: "Permission denied"
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'media';

-- Verify user is authenticated
SELECT auth.uid();
```

### Cleanup Not Running
```bash
# Check cron jobs
SELECT * FROM cron.job WHERE jobname LIKE '%cleanup%';

# Manual trigger
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-expired-media \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# View logs
supabase functions logs cleanup-expired-media --tail
```

---

## 📊 Cost Optimization Checklist

- ✅ WebP format (30-50% savings vs JPEG)
- ✅ Optimal compression (0.6-0.75 quality)
- ✅ Resolution limits enforced
- ✅ Deduplication enabled
- ✅ Stories expire after 24h
- ✅ Temp files expire after 1h
- ✅ Cleanup cron running hourly
- ✅ Orphan cleanup running daily

---

## 🎯 Performance Tips

1. **Use thumbnails**: Generate poster frames for videos
2. **Lazy load**: Load full quality only when needed
3. **Cache aggressively**: Set `Cache-Control: 31536000`
4. **Parallel uploads**: Use `uploadMediaBatch` for multiple files
5. **Show progress**: Always pass `onProgress` callback

---

## 📈 Monitoring

```sql
-- Daily upload stats
SELECT 
  DATE(created_at) as date,
  media_type,
  COUNT(*) as uploads,
  SUM(size_bytes) / 1024 / 1024 as mb
FROM media
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), media_type
ORDER BY date DESC;

-- Cost projection
SELECT 
  SUM(size_bytes) / 1024 / 1024 / 1024 as total_gb,
  COUNT(*) as total_files,
  (SUM(size_bytes) / 1024 / 1024 / 1024 * 0.021) as monthly_cost_usd
FROM media;

-- Cleanup effectiveness
SELECT 
  bucket_name,
  COUNT(*) as expired,
  SUM(size_bytes) / 1024 / 1024 as mb_saved
FROM media
WHERE expires_at < NOW()
GROUP BY bucket_name;
```

---

## 🔗 Quick Links

- **Full Guide**: `MEDIA_PIPELINE_GUIDE.md`
- **SQL Setup**: `supabase-media-setup.sql`
- **Type Definitions**: `lib/media/types.ts`
- **Edge Function**: `supabase/functions/cleanup-expired-media/index.ts`

---

**Need Help?** Check the full guide for detailed examples and explanations.
