/**
 * Hashtag Text Component
 * 
 * Renders text with clickable hashtag badges (like Instagram)
 */

import { Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";

// Brand colors for hashtags and mentions
const HASHTAG_COLOR = "#8A40CF";
const MENTION_COLOR = "#8A40CF";

interface HashtagTextProps {
  text: string;
  onHashtagPress?: (hashtag: string) => void;
  style?: any;
  textStyle?: any;
}

interface TextPart {
  type: "text" | "hashtag" | "mention";
  content: string;
  value: string; // hashtag without #, mention without @
}

export function HashtagText({
  text,
  onHashtagPress,
  style,
  textStyle,
}: HashtagTextProps) {
  const router = useRouter();

  // Parse text into parts (regular text, hashtags, mentions)
  const parts = useMemo(() => {
    if (!text) return [];

    const result: TextPart[] = [];
    // Match hashtags (#word) and mentions (@word)
    const regex = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
          value: text.slice(lastIndex, match.index),
        });
      }

      // Add the hashtag or mention
      const fullMatch = match[0];
      if (fullMatch.startsWith("#")) {
        result.push({
          type: "hashtag",
          content: fullMatch,
          value: fullMatch.slice(1), // Remove #
        });
      } else if (fullMatch.startsWith("@")) {
        result.push({
          type: "mention",
          content: fullMatch,
          value: fullMatch.slice(1), // Remove @
        });
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        type: "text",
        content: text.slice(lastIndex),
        value: text.slice(lastIndex),
      });
    }

    return result;
  }, [text]);

  const handleHashtagPress = (hashtag: string) => {
    if (onHashtagPress) {
      onHashtagPress(hashtag);
    } else {
      // Default: navigate to search with hashtag
      router.push({
        pathname: "/(protected)/search",
        params: { query: `#${hashtag}` },
      } as any);
    }
  };

  const handleMentionPress = (username: string) => {
    router.push(`/(protected)/profile/${username}` as any);
  };

  if (!text) return null;

  return (
    <Text style={[styles.container, style, textStyle]}>
      {parts.map((part, index) => {
        if (part.type === "hashtag") {
          return (
            <Pressable
              key={index}
              onPress={() => handleHashtagPress(part.value)}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.hashtag,
                  { color: HASHTAG_COLOR },
                  textStyle,
                ]}
              >
                {part.content}
              </Text>
            </Pressable>
          );
        } else if (part.type === "mention") {
          return (
            <Pressable
              key={index}
              onPress={() => handleMentionPress(part.value)}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.mention,
                  { color: MENTION_COLOR },
                  textStyle,
                ]}
              >
                {part.content}
              </Text>
            </Pressable>
          );
        } else {
          return (
            <Text key={index} style={textStyle}>
              {part.content}
            </Text>
          );
        }
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexWrap: "wrap",
  },
  hashtag: {
    fontWeight: "600",
  },
  mention: {
    fontWeight: "600",
  },
});
