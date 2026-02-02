-- ============================================================================
-- COMPLETE SUPABASE SETUP: Media Pipeline
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE MEDIA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS media (
  id BIGSERIAL PRIMARY KEY,
  
  -- Storage reference
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  
  -- File metadata
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  
  -- Dimensions
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC(6,2),
  
  -- Deduplication
  hash TEXT NOT NULL,
  
  -- Ownership
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Lifecycle
  bucket_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_video_metadata CHECK (
    media_type != 'video' OR (
      duration_seconds IS NOT NULL AND
      duration_seconds <= 60 AND
      width <= 1920 AND
      height <= 1920
    )
  ),
  CONSTRAINT valid_image_metadata CHECK (
    media_type != 'image' OR (
      width <= 1280 AND
      height <= 1280
    )
  )
);

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_media_hash_owner ON media(hash, owner_id);
CREATE INDEX IF NOT EXISTS idx_media_expires_at ON media(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_bucket_created ON media(bucket_name, created_at);
CREATE INDEX IF NOT EXISTS idx_media_owner_created ON media(owner_id, created_at DESC);

-- ============================================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own media" ON media;
DROP POLICY IF EXISTS "Users can insert own media" ON media;
DROP POLICY IF EXISTS "Users can delete own media" ON media;

-- Users can read their own media + public media
CREATE POLICY "Users can view own media"
  ON media FOR SELECT
  USING (
    owner_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    OR bucket_name IN ('avatars', 'images', 'videos', 'stories')
  );

-- Users can only insert their own media
CREATE POLICY "Users can insert own media"
  ON media FOR INSERT
  WITH CHECK (owner_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- Users can only delete their own media
CREATE POLICY "Users can delete own media"
  ON media FOR DELETE
  USING (owner_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, DELETE ON media TO authenticated;
GRANT USAGE ON SEQUENCE media_id_seq TO authenticated;

-- ============================================================================
-- PART 5: CREATE CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_media()
RETURNS TABLE(deleted_count INTEGER, storage_paths TEXT[]) AS $$
DECLARE
  expired_media RECORD;
  paths TEXT[] := '{}';
  count INTEGER := 0;
BEGIN
  FOR expired_media IN
    SELECT id, storage_path
    FROM media
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
  LOOP
    paths := array_append(paths, expired_media.storage_path);
    DELETE FROM media WHERE id = expired_media.id;
    count := count + 1;
  END LOOP;
  
  RETURN QUERY SELECT count, paths;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: CREATE STORAGE BUCKETS
-- ============================================================================

-- Insert buckets (safe if already exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152, ARRAY['image/webp']),
  ('images', 'images', true, 5242880, ARRAY['image/webp']),
  ('videos', 'videos', true, 52428800, ARRAY['video/mp4']),
  ('stories', 'stories', true, 31457280, ARRAY['image/webp', 'video/mp4']),
  ('temp', 'temp', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 7: STORAGE RLS POLICIES
-- ============================================================================

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public buckets readable" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own files" ON storage.objects;

-- UPLOAD: Users can only upload to their own folder
CREATE POLICY "Users upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('avatars', 'images', 'videos', 'stories', 'temp')
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- READ: Public buckets are readable by all
CREATE POLICY "Public buckets readable"
ON storage.objects FOR SELECT
USING (bucket_id IN ('avatars', 'images', 'videos', 'stories', 'temp'));

-- DELETE: Users can only delete their own files
CREATE POLICY "Users delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('avatars', 'images', 'videos', 'stories', 'temp')
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- ============================================================================
-- PART 8: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pg_cron for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================================
-- PART 9: SCHEDULE CLEANUP JOBS
-- ============================================================================

-- NOTE: Replace YOUR_PROJECT and YOUR_ANON_KEY with actual values

-- Hourly cleanup (expired media)
SELECT cron.schedule(
  'cleanup-expired-media-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-expired-media',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- Daily cleanup (orphaned files) at 2 AM
SELECT cron.schedule(
  'cleanup-orphaned-media-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-expired-media?full=true',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- ============================================================================
-- PART 10: VERIFICATION QUERIES
-- ============================================================================

-- Check media table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'media'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'media';

-- Check RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd, 
  qual
FROM pg_policies
WHERE tablename = 'media';

-- Check storage buckets
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('avatars', 'images', 'videos', 'stories', 'temp');

-- Check storage RLS policies
SELECT 
  policyname, 
  cmd
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects';

-- Check cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%cleanup%';

-- ============================================================================
-- PART 11: USEFUL MONITORING QUERIES
-- ============================================================================

-- Storage stats by bucket
SELECT 
  bucket_name,
  COUNT(*) as file_count,
  ROUND(SUM(size_bytes)::NUMERIC / 1024 / 1024 / 1024, 2) as size_gb,
  ROUND(AVG(size_bytes)::NUMERIC / 1024 / 1024, 2) as avg_size_mb
FROM media
GROUP BY bucket_name
ORDER BY size_gb DESC;

-- Find duplicates (should be rare with deduplication)
SELECT 
  hash,
  COUNT(*) as duplicate_count,
  ROUND(SUM(size_bytes)::NUMERIC / 1024 / 1024, 2) as wasted_mb
FROM media
GROUP BY hash
HAVING COUNT(*) > 1
ORDER BY wasted_mb DESC;

-- Expiring soon (next hour)
SELECT 
  bucket_name,
  COUNT(*) as expiring_soon,
  ROUND(SUM(size_bytes)::NUMERIC / 1024 / 1024, 2) as size_mb
FROM media
WHERE expires_at < NOW() + INTERVAL '1 hour'
GROUP BY bucket_name;

-- Top uploaders (last 7 days)
SELECT 
  u.username,
  COUNT(*) as upload_count,
  ROUND(SUM(m.size_bytes)::NUMERIC / 1024 / 1024, 2) as total_mb
FROM media m
JOIN users u ON m.owner_id = u.id
WHERE m.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.username
ORDER BY total_mb DESC
LIMIT 20;

-- Media type distribution
SELECT 
  media_type,
  COUNT(*) as count,
  ROUND(SUM(size_bytes)::NUMERIC / 1024 / 1024 / 1024, 2) as size_gb,
  ROUND(AVG(size_bytes)::NUMERIC / 1024 / 1024, 2) as avg_size_mb
FROM media
GROUP BY media_type;

-- ============================================================================
-- SETUP COMPLETE! 🎉
-- ============================================================================

-- Next steps:
-- 1. Deploy Edge Function: supabase functions deploy cleanup-expired-media
-- 2. Update cron URLs with your project ref and anon key
-- 3. Test upload: Use examples from MEDIA_PIPELINE_GUIDE.md
-- 4. Monitor costs: Check Supabase dashboard

-- Questions? Check MEDIA_PIPELINE_GUIDE.md for detailed documentation
