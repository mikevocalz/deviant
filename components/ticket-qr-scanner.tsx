/**
 * Ticket QR Code Scanner Component
 *
 * Scans QR codes from tickets and checks them in
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  type Barcode,
  useBarcodeScannerOutput,
} from "react-native-vision-camera-barcode-scanner";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ScanLine } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { tickets } from "@/lib/api/tickets";
import { useUIStore } from "@/lib/stores/ui-store";

interface TicketQRScannerProps {
  eventId: string;
  onClose: () => void;
  onCheckInSuccess?: () => void;
}

export function TicketQRScanner({
  eventId,
  onClose,
  onCheckInSuccess,
}: TicketQRScannerProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const showToast = useUIStore((s) => s.showToast);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  // Refs for guards to avoid stale closures inside the barcode callback
  const isCheckingInRef = useRef(false);
  const scannedCodeRef = useRef<string | null>(null);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleCheckIn = useCallback(
    async (qrToken: string) => {
      if (isCheckingInRef.current) return;
      isCheckingInRef.current = true;
      setIsCheckingIn(true);
      try {
        const result = await tickets.checkIn({ qrToken });

        if ((result as any).alreadyCheckedIn) {
          showToast(
            "info",
            "Already Checked In",
            "This ticket was already checked in.",
          );
        } else if ((result as any).success) {
          showToast("success", "Checked In", "Ticket successfully checked in!");
          onCheckInSuccess?.();
          setTimeout(() => {
            scannedCodeRef.current = null;
            isCheckingInRef.current = false;
            setIsCheckingIn(false);
          }, 2000);
          return;
        } else {
          throw new Error((result as any).error || "Check-in failed");
        }
      } catch (error: any) {
        console.error("[QRScanner] Check-in error:", error);
        const errorMessage =
          error?.error || error?.message || "Failed to check in ticket";
        showToast("error", "Check-In Failed", errorMessage);
      }
      scannedCodeRef.current = null;
      isCheckingInRef.current = false;
      setIsCheckingIn(false);
    },
    [onCheckInSuccess, showToast],
  );

  const onBarcodeScanned = useCallback(
    (barcodes: Barcode[]) => {
      if (barcodes.length > 0 && !isCheckingInRef.current && !scannedCodeRef.current) {
        const code = barcodes[0]?.rawValue;
        if (code) {
          scannedCodeRef.current = code;
          void handleCheckIn(code);
        }
      }
    },
    [handleCheckIn],
  );

  const barcodeScannerOutput = useBarcodeScannerOutput({
    barcodeFormats: ["qr-code"],
    outputResolution: "full",
    onBarcodeScanned,
    onError: (error) => {
      console.error("[QRScanner] Barcode scan error:", error);
    },
  });

  if (!device) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Scan Ticket
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Camera not available
          </Text>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Scan Ticket QR Code
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Camera permission is required to scan tickets
          </Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={styles.permissionButton}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Scan Ticket QR Code
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!isCheckingIn}
          outputs={[barcodeScannerOutput]}
        />

        {/* Scanning Overlay */}
        <View style={styles.overlay}>
          {/* Top overlay */}
          <View style={styles.overlayTop} />

          {/* Middle section with scanning window */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanWindow}>
              {/* Corner indicators */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Scanning line animation */}
              {!isCheckingIn && (
                <View style={styles.scanLine}>
                  <ScanLine size={20} color="#8A40CF" />
                </View>
              )}
            </View>
            <View style={styles.overlaySide} />
          </View>

          {/* Bottom overlay */}
          <View style={styles.overlayBottom}>
            {isCheckingIn ? (
              <View style={styles.checkingInContainer}>
                <ActivityIndicator size="large" color="#8A40CF" />
                <Text
                  style={[styles.checkingInText, { color: colors.foreground }]}
                >
                  Checking in...
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.instructionText, { color: colors.foreground }]}
              >
                Position the QR code within the frame
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
    width: "100%",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  scanWindow: {
    width: 250,
    height: 250,
    position: "relative",
    borderWidth: 2,
    borderColor: "#8A40CF",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#8A40CF",
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    transform: [{ translateY: -10 }],
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#8A40CF",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  checkingInContainer: {
    alignItems: "center",
    gap: 12,
  },
  checkingInText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
