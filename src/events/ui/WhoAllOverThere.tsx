/**
 * "Who All Over There 👀" — ephemeral event moment tray.
 * Shows photo/video moments uploaded by ticket holders and hosts.
 * Expires 24h after the event ends.
 */

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { X, Camera, Play } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useEventDetailScreenStore } from "@/lib/stores/event-detail-screen-store";
import { uploadToServer } from "@/lib/server-upload";
import { invokeEdge } from "@/lib/api/invoke-edge";

const THUMB_SIZE = 76;
const MAX_VIDEO_SECONDS = 30;

interface Moment {
  id: number;
  media_url: string;
  media_type: "photo" | "video";
  duration_sec: number | null;
  created_at: string;
}

interface WhoAllOverThereProps {
  eventId: string;
  canUpload: boolean; // ticket holder or host
}

function useMoments(eventId: string) {
  return useQuery({
    queryKey: ["event-moments", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_moments")
        .select("id, media_url, media_type, duration_sec, created_at")
        .eq("event_id", parseInt(eventId))
        .gt("expires_at", new Date().toISOString())
        .eq("is_flagged", false)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        console.error("[WhoAllOverThere] fetch error:", error);
        return [] as Moment[];
      }
      return (data || []) as Moment[];
    },
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// Fullscreen video moment
function VideoMoment({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={styles.viewerMedia} contentFit="contain" />;
}

// Fullscreen moment viewer
const MomentViewer = memo(function MomentViewer({
  moments,
  initialIndex,
  onClose,
}: {
  moments: Moment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const moment = moments[initialIndex];
  if (!moment) return null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.viewerOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.viewerContent}>
          {moment.media_type === "video" ? (
            <VideoMoment uri={moment.media_url} />
          ) : (
            <Image
              source={{ uri: moment.media_url }}
              style={styles.viewerMedia}
              contentFit="contain"
            />
          )}
        </View>
        <Pressable style={styles.viewerClose} onPress={onClose} hitSlop={12}>
          <X size={20} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
});

// Individual thumbnail
const MomentThumb = memo(function MomentThumb({
  moment,
  onPress,
}: {
  moment: Moment;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.thumb}>
      <Image
        source={{ uri: moment.media_url }}
        style={styles.thumbImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      {moment.media_type === "video" && (
        <View style={styles.playBadge}>
          <Play size={10} color="#fff" fill="#fff" />
        </View>
      )}
    </Pressable>
  );
});

export const WhoAllOverThere = memo(function WhoAllOverThere({
  eventId,
  canUpload,
}: WhoAllOverThereProps) {
  const queryClient = useQueryClient();
  const { data: moments = [], isLoading } = useMoments(eventId);

  const viewerIndex = useEventDetailScreenStore((s) => s.momentViewerIndex);
  const setViewerIndex = useEventDetailScreenStore((s) => s.setMomentViewerIndex);
  const uploading = useEventDetailScreenStore((s) => s.uploadingMoment);
  const setUploading = useEventDetailScreenStore((s) => s.setUploadingMoment);

  const createMoment = useMutation({
    mutationFn: async (vars: { mediaUrl: string; mediaType: "photo" | "video"; durationSec?: number }) => {
      const result = await invokeEdge("create-event-moment", {
        eventId: parseInt(eventId),
        mediaUrl: vars.mediaUrl,
        mediaType: vars.mediaType,
        durationSec: vars.durationSec,
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-moments", eventId] });
    },
  });

  const handleUpload = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to post moments.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.85,
        videoMaxDuration: MAX_VIDEO_SECONDS,
        allowsEditing: true,
      });

      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];

      const isVideo = asset.type === "video";
      if (isVideo && asset.duration != null && asset.duration > MAX_VIDEO_SECONDS * 1000) {
        Alert.alert("Too long", `Videos must be ${MAX_VIDEO_SECONDS} seconds or less.`);
        return;
      }

      setUploading(true);

      const folder = isVideo ? "posts" : "events";
      const uploadResult = await uploadToServer(asset.uri, folder);
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      await createMoment.mutateAsync({
        mediaUrl: uploadResult.url,
        mediaType: isVideo ? "video" : "photo",
        durationSec: isVideo && asset.duration != null ? asset.duration / 1000 : undefined,
      });
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }, [eventId, createMoment, setUploading]);

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Who's Over Here</Text>
        {uploading && <ActivityIndicator size="small" color="#8A40CF" style={{ marginLeft: 8 }} />}
      </View>

      {/* Moment tray */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tray}
      >
        {/* Upload button — shown first if user can post */}
        {canUpload && (
          <Pressable onPress={uploading ? undefined : handleUpload} style={styles.uploadBtn} disabled={uploading}>
            <Camera size={22} color={uploading ? "rgba(255,255,255,0.3)" : "#8A40CF"} />
            <Text style={[styles.uploadLabel, uploading && { opacity: 0.4 }]}>Add</Text>
          </Pressable>
        )}

        {isLoading && !moments.length ? (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" style={{ marginLeft: 8 }} />
        ) : moments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyText}>
              {canUpload
                ? "Be the first to post a moment from this event"
                : "No moments yet — ticket holders can post here"}
            </Text>
          </View>
        ) : (
          moments.map((m, i) => (
            <MomentThumb key={m.id} moment={m} onPress={() => setViewerIndex(i)} />
          ))
        )}
      </ScrollView>

      {/* Fullscreen viewer */}
      {viewerIndex >= 0 && moments.length > 0 && (
        <MomentViewer
          moments={moments}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(-1)}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  tray: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
    alignItems: "center",
  },
  uploadBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    backgroundColor: "rgba(138,64,207,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(138,64,207,0.35)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  uploadLabel: {
    color: "#8A40CF",
    fontSize: 11,
    fontWeight: "600",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  playBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
    maxWidth: 260,
  },
  emptyEmoji: {
    fontSize: 24,
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    flexShrink: 1,
  },
  // Viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerContent: {
    width: "92%",
    aspectRatio: 9 / 16,
    maxHeight: "80%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  viewerMedia: {
    width: "100%",
    height: "100%",
  },
  viewerClose: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
