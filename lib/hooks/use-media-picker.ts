import { useState } from "react"
import * as ImagePicker from "expo-image-picker"
import * as MediaLibrary from "expo-media-library"
import { Alert, Platform } from "react-native"

export interface MediaAsset {
  id: string
  uri: string
  type: "image" | "video"
  width?: number
  height?: number
  duration?: number
  fileName?: string
}

export function useMediaPicker() {
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([])
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const requestPermissions = async () => {
    if (Platform.OS === "web") {
      setHasPermission(true)
      return true
    }

    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync()

    const granted = cameraStatus === "granted" && mediaStatus === "granted"
    setHasPermission(granted)

    if (!granted) {
      Alert.alert(
        "Permissions Required",
        "Please grant camera and media library permissions to select photos and videos.",
      )
    }

    return granted
  }

  const pickFromLibrary = async (options?: { maxSelection?: number; allowsMultipleSelection?: boolean }) => {
    const hasPermission = await requestPermissions()
    if (!hasPermission) return

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: options?.allowsMultipleSelection ?? true,
        quality: 1,
        videoMaxDuration: 60,
        selectionLimit: options?.maxSelection ?? 10,
      })

      if (!result.canceled && result.assets) {
        const newMedia: MediaAsset[] = result.assets.map((asset) => ({
          id: asset.assetId || asset.uri,
          uri: asset.uri,
          type: asset.type === "video" ? "video" : "image",
          width: asset.width,
          height: asset.height,
          duration: asset.duration ?? undefined,
          fileName: asset.fileName ?? undefined,
        }))

        setSelectedMedia((prev) => [...prev, ...newMedia])
        return newMedia
      }
    } catch (error) {
      console.error("[v0] Error picking media:", error)
      Alert.alert("Error", "Failed to pick media. Please try again.")
    }
  }

  const takePhoto = async () => {
    const hasPermission = await requestPermissions()
    if (!hasPermission) return

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: true,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        const newMedia: MediaAsset = {
          id: asset.assetId || asset.uri,
          uri: asset.uri,
          type: "image",
          width: asset.width,
          height: asset.height,
          fileName: asset.fileName ?? undefined,
        }

        setSelectedMedia((prev) => [...prev, newMedia])
        return newMedia
      }
    } catch (error) {
      console.error("[v0] Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo. Please try again.")
    }
  }

  const recordVideo = async () => {
    const hasPermission = await requestPermissions()
    if (!hasPermission) return

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: 60,
        quality: 1,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        const newMedia: MediaAsset = {
          id: asset.assetId || asset.uri,
          uri: asset.uri,
          type: "video",
          width: asset.width,
          height: asset.height,
          duration: asset.duration ?? undefined,
          fileName: asset.fileName ?? undefined,
        }

        setSelectedMedia((prev) => [...prev, newMedia])
        return newMedia
      }
    } catch (error) {
      console.error("[v0] Error recording video:", error)
      Alert.alert("Error", "Failed to record video. Please try again.")
    }
  }

  const removeMedia = (id: string) => {
    setSelectedMedia((prev) => prev.filter((item) => item.id !== id))
  }

  const clearAll = () => {
    setSelectedMedia([])
  }

  return {
    selectedMedia,
    hasPermission,
    pickFromLibrary,
    takePhoto,
    recordVideo,
    removeMedia,
    clearAll,
    requestPermissions,
  }
}
