import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRef, useState, useEffect } from "react";
import { Camera, useCameraDevice } from "react-native-vision-camera";
// TextRecognition removed due to GoogleMLKit version conflict - see CLAUDE.md
// TODO: Re-add OCR when compatible version is available
import * as ImagePicker from "expo-image-picker";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  CreditCard,
  Camera as CameraIcon,
  ImageIcon,
  X,
  ScanLine,
} from "lucide-react-native";
import { persistVerificationPhoto } from "@/lib/media";
import { useVerificationStore } from "@/lib/stores/useVerificationStore";
import { Button, Progress } from "@/components/ui";
import { extractDOBFromText } from "@/lib/dob-extractor";

type Mode = "select" | "camera" | "preview" | "scanning";

export default function IdScanTab() {
  const [mode, setMode] = useState<Mode>("select");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string>("");
  const [extractedDob, setExtractedDob] = useState<string | null>(null);

  const camRef = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const showToast = useUIStore((s) => s.showToast);

  // Simulate scanning progress
  useEffect(() => {
    if (mode !== "scanning") return;

    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [mode]);

  const idComplete = useVerificationStore((s) => s.idComplete);
  const storedImageUri = useVerificationStore((s) => s.idImageUri);
  const setIdComplete = useVerificationStore((s) => s.setIdComplete);
  const setIdImageUri = useVerificationStore((s) => s.setIdImageUri);
  const setParsedId = useVerificationStore((s) => s.setParsedId);

  // Handle scan completion in useEffect to avoid setState during render
  useEffect(() => {
    if (mode !== "scanning" || !imageUri || scanProgress < 100 || busy) return;

    setBusy(true);

    // Extract DOB from accumulated OCR text
    const dobResult = extractDOBFromText(ocrText);
    console.log("[IdScanTab] DOB extraction result:", dobResult);

    if (dobResult.dateOfBirth) {
      setParsedId({ dob: dobResult.dateOfBirth });
      setExtractedDob(dobResult.dateOfBirth);
      console.log("[IdScanTab] Extracted DOB:", dobResult.formattedDate);
    }

    persistVerificationPhoto(imageUri, "id")
      .then((saved) => {
        setIdImageUri(saved);
        setIdComplete(true);
        if (dobResult.dateOfBirth) {
          showToast("success", "ID Scanned", `DOB: ${dobResult.formattedDate}`);
        } else {
          showToast("success", "ID scanned successfully");
        }
      })
      .catch((e: any) => {
        showToast("error", "Error", e?.message ?? "Failed to save ID");
        setMode("preview");
      })
      .finally(() => setBusy(false));
  }, [
    mode,
    imageUri,
    scanProgress,
    busy,
    ocrText,
    setParsedId,
    setIdImageUri,
    setIdComplete,
  ]);

  // If already completed, show the stored image
  if (idComplete && storedImageUri) {
    return (
      <View
        className="flex-1 bg-background rounded-2xl overflow-hidden"
        style={{ minHeight: 300 }}
      >
        <Image
          source={{ uri: storedImageUri }}
          className="flex-1"
          resizeMode="contain"
        />
        <View className="absolute top-3 right-3">
          <TouchableOpacity
            onPress={() => {
              setIdComplete(false);
              setIdImageUri("");
              setParsedId({});
              setImageUri(null);
              setMode("select");
            }}
            className="bg-black/50 rounded-full p-2"
          >
            <X size={20} color="white" />
          </TouchableOpacity>
        </View>
        <View className="absolute bottom-4 left-0 right-0 items-center">
          <View className="bg-primary/90 px-4 py-2 rounded-full">
            <Text className="text-primary-foreground font-medium">
              ID Captured ✓
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Selection screen
  if (mode === "select") {
    return (
      <View
        className="flex-1 bg-card rounded-2xl items-center justify-center gap-6 p-6"
        style={{ minHeight: 300 }}
      >
        <View className="bg-muted/30 rounded-full p-6">
          <CreditCard size={48} className="text-muted-foreground" />
        </View>

        <View className="items-center gap-2">
          <Text className="text-lg font-semibold text-foreground">
            Upload ID Document
          </Text>
          <Text className="text-sm text-muted text-center">
            Take a photo or choose an existing image of your government-issued
            ID
          </Text>
        </View>

        <View className="w-full gap-3">
          <Button
            onPress={() => {
              setOcrText("");
              setMode("camera");
            }}
            className="flex-row items-center justify-center gap-2"
          >
            <CameraIcon size={18} color="white" />
            <Text className="text-primary-foreground font-medium">
              Take Photo
            </Text>
          </Button>

          <Button
            variant="outline"
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [16, 10],
                quality: 0.9,
              });

              if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                setImageUri(uri);

                // OCR temporarily disabled - TextRecognition package removed due to GoogleMLKit conflict
                console.log(
                  "[IdScanTab] OCR disabled - using manual verification",
                );

                setMode("preview");
              }
            }}
            className="flex-row items-center justify-center gap-2"
          >
            <ImageIcon size={18} className="text-foreground" />
            <Text className="text-foreground font-medium">
              Choose from Library
            </Text>
          </Button>
        </View>
      </View>
    );
  }

  // Camera mode
  if (mode === "camera") {
    if (!device) {
      return (
        <View
          className="flex-1 bg-card rounded-2xl items-center justify-center"
          style={{ minHeight: 300 }}
        >
          <Text className="text-muted">Camera not available</Text>
          <Button
            variant="outline"
            onPress={() => setMode("select")}
            className="mt-4"
          >
            Go Back
          </Button>
        </View>
      );
    }

    return (
      <View
        className="flex-1 bg-background rounded-2xl overflow-hidden"
        style={{ minHeight: 300 }}
      >
        <Camera
          ref={camRef}
          style={{ flex: 1 }}
          device={device}
          isActive
          photo
        />

        {/* ID frame overlay */}
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
        >
          <View
            className="border-2 border-white/70 rounded-xl"
            style={{ width: "85%", aspectRatio: 1.6 }}
          />
        </View>

        <View className="absolute bottom-6 left-0 right-0 px-6 gap-3">
          <Text className="text-center text-white text-sm mb-2">
            Position your ID within the frame
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={() => setMode("select")}
              className="flex-1 bg-black/30"
            >
              <Text className="text-white">Cancel</Text>
            </Button>
            <Button
              onPress={async () => {
                try {
                  setBusy(true);
                  const photo = await camRef.current?.takePhoto();
                  if (!photo?.path) throw new Error("Failed to capture");
                  const uri = photo.path.startsWith("file://")
                    ? photo.path
                    : `file://${photo.path}`;
                  setImageUri(uri);
                  setMode("preview");
                } catch (e: any) {
                  showToast("error", "Capture failed", e?.message);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="flex-1"
            >
              <Text className="text-primary-foreground">
                {busy ? "Capturing..." : "Capture"}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    );
  }

  // Preview mode
  if (mode === "preview" && imageUri) {
    return (
      <View
        className="flex-1 bg-background rounded-2xl overflow-hidden"
        style={{ minHeight: 300 }}
      >
        <Image
          source={{ uri: imageUri }}
          className="flex-1"
          resizeMode="contain"
        />

        <View className="absolute bottom-6 left-0 right-0 px-6 gap-3">
          <Text className="text-center text-muted text-sm mb-2">
            Make sure your ID is clearly visible
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={() => {
                setImageUri(null);
                setMode("select");
              }}
              className="flex-1"
            >
              <Text className="text-foreground">Retake</Text>
            </Button>
            <Button
              onPress={() => setMode("scanning")}
              disabled={busy}
              className="flex-1"
            >
              <Text className="text-primary-foreground">Use This Photo</Text>
            </Button>
          </View>
        </View>
      </View>
    );
  }

  // Scanning mode with progress bar
  if (mode === "scanning" && imageUri) {
    const progressValue = Math.min(Math.round(scanProgress), 100);

    return (
      <View
        className="flex-1 bg-card rounded-2xl items-center justify-center gap-6 p-6"
        style={{ minHeight: 300 }}
      >
        {/* Scan icon */}
        <View className="bg-primary/20 rounded-full p-6">
          <ScanLine size={48} className="text-primary" />
        </View>

        <Text className="text-lg font-semibold text-foreground">
          Scanning ID Document...
        </Text>

        {/* Progress bar */}
        <View className="w-full gap-2">
          <Progress value={progressValue} className="h-2" />
          <Text className="text-center text-muted text-sm">
            {progressValue}% complete
          </Text>
        </View>

        {/* Show extracted info */}
        {ocrText.length > 50 && (
          <View className="bg-muted/20 rounded-lg p-3 w-full">
            <Text className="text-xs text-muted text-center">
              Text detected: {ocrText.length} characters
            </Text>
          </View>
        )}
      </View>
    );
  }

  return null;
}
