-- Notification Triggers
-- Automatically send push notifications when certain events occur

-- Helper function to call the send_notification Edge Function
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get Supabase URL from environment (set in Supabase dashboard)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, skip (will be handled by Edge Function triggers instead)
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN;
  END IF;
  
  -- Call the Edge Function via pg_net (if available)
  -- Note: This requires pg_net extension to be enabled
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send_notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'userId', p_user_id,
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. FOLLOW NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION on_new_follow() RETURNS TRIGGER AS $$
DECLARE
  follower_username TEXT;
  follower_avatar TEXT;
BEGIN
  -- Get follower info
  SELECT username, 
         COALESCE((SELECT url FROM media WHERE id = avatar_id), '') 
  INTO follower_username, follower_avatar
  FROM users 
  WHERE auth_id = NEW.follower_id;
  
  -- Send notification to the followed user
  PERFORM notify_user(
    NEW.following_id,
    'follow',
    'New Follower',
    follower_username || ' started following you',
    jsonb_build_object(
      'senderId', NEW.follower_id,
      'senderUsername', follower_username,
      'senderAvatar', follower_avatar
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for follows
DROP TRIGGER IF EXISTS trigger_new_follow ON follows;
CREATE TRIGGER trigger_new_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION on_new_follow();

-- 2. MESSAGE NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION on_new_message() RETURNS TRIGGER AS $$
DECLARE
  sender_username TEXT;
  sender_avatar TEXT;
  recipient_id UUID;
  conv_participant RECORD;
BEGIN
  -- Get sender info
  SELECT username,
         COALESCE((SELECT url FROM media WHERE id = avatar_id), '')
  INTO sender_username, sender_avatar
  FROM users
  WHERE id = NEW.sender_id;
  
  -- Get all participants in the conversation except sender
  FOR conv_participant IN
    SELECT u.auth_id
    FROM conversations_rels cr
    JOIN users u ON u.id = cr.users_id
    WHERE cr.parent_id = NEW.conversation_id
    AND u.id != NEW.sender_id
  LOOP
    -- Send notification to each participant
    PERFORM notify_user(
      conv_participant.auth_id,
      'message',
      sender_username,
      CASE 
        WHEN LENGTH(NEW.content) > 50 THEN SUBSTRING(NEW.content, 1, 50) || '...'
        ELSE NEW.content
      END,
      jsonb_build_object(
        'senderId', (SELECT auth_id FROM users WHERE id = NEW.sender_id),
        'senderUsername', sender_username,
        'senderAvatar', sender_avatar,
        'conversationId', NEW.conversation_id
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for messages
DROP TRIGGER IF EXISTS trigger_new_message ON messages;
CREATE TRIGGER trigger_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION on_new_message();

-- 3. LIKE NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION on_new_like() RETURNS TRIGGER AS $$
DECLARE
  liker_username TEXT;
  liker_avatar TEXT;
  post_author_id UUID;
  post_thumbnail TEXT;
BEGIN
  -- Get liker info
  SELECT username,
         COALESCE((SELECT url FROM media WHERE id = avatar_id), '')
  INTO liker_username, liker_avatar
  FROM users
  WHERE id = NEW.user_id;
  
  -- Get post author and thumbnail
  SELECT u.auth_id,
         COALESCE((SELECT url FROM media WHERE id = p.media_id LIMIT 1), '')
  INTO post_author_id, post_thumbnail
  FROM posts p
  JOIN users u ON u.id = p.author_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user liked their own post
  IF post_author_id = (SELECT auth_id FROM users WHERE id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  
  -- Send notification
  PERFORM notify_user(
    post_author_id,
    'like',
    'New Like',
    liker_username || ' liked your post',
    jsonb_build_object(
      'senderId', (SELECT auth_id FROM users WHERE id = NEW.user_id),
      'senderUsername', liker_username,
      'senderAvatar', liker_avatar,
      'postId', NEW.post_id,
      'postThumbnail', post_thumbnail
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for likes
DROP TRIGGER IF EXISTS trigger_new_like ON likes;
CREATE TRIGGER trigger_new_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION on_new_like();

-- 4. COMMENT NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION on_new_comment() RETURNS TRIGGER AS $$
DECLARE
  commenter_username TEXT;
  commenter_avatar TEXT;
  post_author_id UUID;
  post_thumbnail TEXT;
BEGIN
  -- Get commenter info
  SELECT username,
         COALESCE((SELECT url FROM media WHERE id = avatar_id), '')
  INTO commenter_username, commenter_avatar
  FROM users
  WHERE id = NEW.author_id;
  
  -- Get post author and thumbnail
  SELECT u.auth_id,
         COALESCE((SELECT url FROM media WHERE id = p.media_id LIMIT 1), '')
  INTO post_author_id, post_thumbnail
  FROM posts p
  JOIN users u ON u.id = p.author_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user commented on their own post
  IF post_author_id = (SELECT auth_id FROM users WHERE id = NEW.author_id) THEN
    RETURN NEW;
  END IF;
  
  -- Send notification
  PERFORM notify_user(
    post_author_id,
    'comment',
    'New Comment',
    commenter_username || ' commented: ' || 
      CASE 
        WHEN LENGTH(NEW.content) > 30 THEN SUBSTRING(NEW.content, 1, 30) || '...'
        ELSE NEW.content
      END,
    jsonb_build_object(
      'senderId', (SELECT auth_id FROM users WHERE id = NEW.author_id),
      'senderUsername', commenter_username,
      'senderAvatar', commenter_avatar,
      'postId', NEW.post_id,
      'postThumbnail', post_thumbnail,
      'content', NEW.content
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comments
DROP TRIGGER IF EXISTS trigger_new_comment ON comments;
CREATE TRIGGER trigger_new_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION on_new_comment();
