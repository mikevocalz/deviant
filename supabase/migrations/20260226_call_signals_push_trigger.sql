-- ================================================================
-- Database Trigger: Send Push Notification on Incoming Call
-- ================================================================
--
-- When a call_signals row is inserted with status='ringing',
-- automatically send a push notification to the callee to
-- wake/alert the app even when it's backgrounded or killed.
--
-- This ensures incoming calls ring reliably on both platforms.
-- ================================================================

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION public.send_call_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_callee_int_id INTEGER;
BEGIN
  -- Only send push for ringing calls
  IF NEW.status <> 'ringing' THEN
    RETURN NEW;
  END IF;

  -- Convert callee_id (auth.id TEXT) to integer users.id
  -- call_signals.callee_id is auth.id (uuid), we need users.id (integer)
  SELECT id INTO v_callee_int_id
  FROM public.users
  WHERE auth_id = NEW.callee_id;

  IF v_callee_int_id IS NULL THEN
    -- User not found, skip push (maybe user not synced yet)
    RAISE WARNING 'call_signals trigger: No user found for auth_id %', NEW.callee_id;
    RETURN NEW;
  END IF;

  -- Call the Edge Function asynchronously via pg_net
  -- REF: https://supabase.com/docs/guides/database/extensions/pg_net
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send_notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
      ),
      body := jsonb_build_object(
        'userId', v_callee_int_id,
        'title', COALESCE(NEW.caller_username, 'Unknown') || ' is calling...',
        'body', CASE
          WHEN NEW.call_type = 'video' THEN 'Incoming video call'
          ELSE 'Incoming call'
        END,
        'type', 'call',
        'data', jsonb_build_object(
          'callType', NEW.call_type,
          'roomId', NEW.room_id,
          'callerId', NEW.caller_id,
          'callerUsername', NEW.caller_username,
          'callerAvatar', NEW.caller_avatar
        )
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS call_signals_push_trigger ON public.call_signals;
CREATE TRIGGER call_signals_push_trigger
  AFTER INSERT ON public.call_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.send_call_push_notification();

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.send_call_push_notification() TO service_role;

-- Set app settings for pg_net (replace with actual values)
-- These should be set via: ALTER DATABASE postgres SET app.supabase_url = '...';
-- For now, the trigger expects these to be set at the database level.
COMMENT ON FUNCTION public.send_call_push_notification IS
  'Automatically sends push notification when a call signal is created. Requires app.supabase_url and app.supabase_service_key settings.';
