import { View, Pressable, Modal, Dimensions, StyleSheet, StatusBar } from "react-native"
import { Image } from "expo-image"
import { VideoView, useVideoPlayer } from "expo-video"
import { X } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useEffect, useCallback } from "react"

interface MediaPreviewModalProps {
  visible: boolean
  onClose: () => void
  media: {
    type: "image" | "video"
    uri: string
  } | null
}

const { width, height } = Dimensions.get("window")

export function MediaPreviewModal({ visible, onClose, media }: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets()
  
  const player = useVideoPlayer(
    media?.type === "video" ? media.uri : "",
    (p) => {
      p.loop = true
    }
  )

  useEffect(() => {
    if (visible && media?.type === "video" && player) {
      try {
        player.play()
      } catch {}
    }
    return () => {
      if (player) {
        try {
          player.pause()
        } catch {}
      }
    }
  }, [visible, media, player])

  const handleClose = useCallback(() => {
    if (player) {
      try {
        player.pause()
      } catch {}
    }
    onClose()
  }, [player, onClose])

  if (!media) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
      <View style={styles.container}>
        <Pressable 
          style={[styles.closeButton, { top: insets.top + 16 }]} 
          onPress={handleClose}
          hitSlop={16}
        >
          <View style={styles.closeIconContainer}>
            <X size={24} color="#fff" />
          </View>
        </Pressable>

        <View style={styles.mediaContainer}>
          {media.type === "image" ? (
            <Image
              source={{ uri: media.uri }}
              style={styles.media}
              contentFit="contain"
            />
          ) : (
            <VideoView
              player={player}
              style={styles.media}
              contentFit="contain"
              nativeControls
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  closeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaContainer: {
    width,
    height: height * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: "100%",
    height: "100%",
  },
})
