-- Null out notifications.entity_id when the referenced post is deleted.
-- This prevents dead links in the activity feed.
-- entity_id is varchar, posts.id is integer — no FK possible, use trigger instead.

CREATE OR REPLACE FUNCTION public.nullify_notifications_on_post_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET entity_id = NULL
  WHERE entity_type = 'post'
    AND entity_id = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_nullify_notifications_on_post_delete ON public.posts;

CREATE TRIGGER trg_nullify_notifications_on_post_delete
  BEFORE DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.nullify_notifications_on_post_delete();

-- Also null out existing dead-link notifications from the P0 incident.
UPDATE public.notifications
SET entity_id = NULL
WHERE entity_type = 'post'
  AND entity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id::text = notifications.entity_id
  );

-- Verify
DO $$
DECLARE
  dead_count int;
BEGIN
  SELECT COUNT(*) INTO dead_count
  FROM public.notifications
  WHERE entity_type = 'post'
    AND entity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id::text = notifications.entity_id);

  IF dead_count > 0 THEN
    RAISE EXCEPTION 'Dead notification links still exist after cleanup: %', dead_count;
  END IF;
  RAISE NOTICE 'Notification cleanup verified: 0 dead links remaining';
END;
$$;
