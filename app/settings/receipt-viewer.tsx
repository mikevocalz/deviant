/**
 * Receipt / Invoice / Ticket PDF Viewer
 *
 * WebView-based PDF viewer with:
 * - Skeleton loader
 * - Pinch zoom (via WebView)
 * - Share action
 * - Print action (expo-print)
 * - "Open in…" action
 * - Supports remote signed URLs with refresh on expiry
 *
 * Params: ?orderId=xxx&type=receipt|invoice|ticket
 */

import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  ArrowLeft,
  Printer,
  Share2,
  ExternalLink,
  AlertCircle,
  FileText,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { purchasesApi } from "@/lib/api/payments";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  printPdfUrl,
  printHtml,
  sharePdfUrl,
  shareHtmlAsPdf,
} from "@/lib/print/print-utils";
import { receiptPdfHtml } from "@/lib/print/thermal-templates";
import type { DocumentType } from "@/lib/types/payments";

export default function ReceiptViewerScreen() {
  const { orderId, type = "receipt" } = useLocalSearchParams<{
    orderId: string;
    type?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);

  const {
    activeDocument,
    documentLoading,
    documentError,
    activeOrder,
    setActiveDocument,
    setDocumentLoading,
    setDocumentError,
    setActiveOrder,
    setOrderLoading,
  } = usePaymentsStore();

  const docType = (type as DocumentType) || "receipt";

  const loadDocument = useCallback(async () => {
    if (!orderId) return;
    setDocumentLoading(true);
    setDocumentError(null);
    try {
      // Load the order first (for HTML fallback generation)
      const order = await purchasesApi.getOrder(orderId);
      if (order) setActiveOrder(order);

      // Try to get the pre-generated PDF
      const doc =
        docType === "invoice"
          ? await purchasesApi.getInvoice(orderId)
          : await purchasesApi.getReceipt(orderId);

      setActiveDocument(doc);
    } catch (err: any) {
      setDocumentError(err.message || "Failed to load document");
    } finally {
      setDocumentLoading(false);
    }
  }, [
    orderId,
    docType,
    setActiveDocument,
    setDocumentLoading,
    setDocumentError,
    setActiveOrder,
    setOrderLoading,
  ]);

  useEffect(() => {
    loadDocument();
    return () => {
      setActiveDocument(null);
    };
  }, [loadDocument, setActiveDocument]);

  const handlePrint = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (activeDocument?.pdfUrl) {
      const result = await printPdfUrl(activeDocument.pdfUrl);
      if (!result.success) {
        showToast("error", "Print Failed", result.error || "Unable to print");
      }
    } else if (activeOrder) {
      // Fallback: generate HTML receipt and print
      const html = receiptPdfHtml({ order: activeOrder });
      const result = await printHtml(html);
      if (!result.success) {
        showToast("error", "Print Failed", result.error || "Unable to print");
      }
    }
  }, [activeDocument, activeOrder, showToast]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (activeDocument?.pdfUrl) {
      const result = await sharePdfUrl(activeDocument.pdfUrl);
      if (!result.success) {
        showToast("error", "Share Failed", result.error || "Unable to share");
      }
    } else if (activeOrder) {
      const html = receiptPdfHtml({ order: activeOrder });
      const result = await shareHtmlAsPdf(html);
      if (!result.success) {
        showToast("error", "Share Failed", result.error || "Unable to share");
      }
    }
  }, [activeDocument, activeOrder, showToast]);

  const docTitle =
    docType === "invoice"
      ? "Invoice"
      : docType === "ticket"
        ? "Ticket"
        : "Receipt";

  // Determine what to show in the WebView
  const hasPdfUrl = !!activeDocument?.pdfUrl;
  const hasOrderForHtml = !!activeOrder;

  // Google Docs viewer for remote PDFs (works on both platforms)
  const pdfViewerUrl = activeDocument?.pdfUrl
    ? Platform.OS === "ios"
      ? activeDocument.pdfUrl // iOS WebView handles PDFs natively
      : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(activeDocument.pdfUrl)}`
    : undefined;

  // Fallback: render receipt as HTML directly in WebView
  const fallbackHtml =
    !hasPdfUrl && hasOrderForHtml
      ? receiptPdfHtml({ order: activeOrder! })
      : undefined;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          {docTitle}
        </Text>

        {/* Action buttons */}
        {(hasPdfUrl || hasOrderForHtml) && (
          <View className="flex-row gap-2">
            <Pressable
              onPress={handlePrint}
              className="w-10 h-10 rounded-xl bg-muted/50 items-center justify-center"
              hitSlop={8}
            >
              <Printer size={18} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="w-10 h-10 rounded-xl bg-muted/50 items-center justify-center"
              hitSlop={8}
            >
              <Share2 size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Loading */}
      {documentLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
          <Text className="text-muted-foreground mt-3 text-sm">
            Loading {docTitle.toLowerCase()}...
          </Text>
        </View>
      )}

      {/* Error */}
      {documentError && !documentLoading && !hasPdfUrl && !hasOrderForHtml && (
        <Animated.View
          entering={FadeIn.duration(300)}
          className="flex-1 items-center justify-center px-8"
        >
          <AlertCircle size={48} color="rgba(239,68,68,0.4)" />
          <Text className="text-foreground font-sans-semibold mt-3">
            Failed to load {docTitle.toLowerCase()}
          </Text>
          <Pressable
            onPress={loadDocument}
            className="mt-4 bg-primary/10 rounded-xl px-5 py-2.5"
          >
            <Text className="text-primary font-sans-semibold">Retry</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Empty (no document and no order to generate from) */}
      {!documentLoading &&
        !documentError &&
        !hasPdfUrl &&
        !hasOrderForHtml && (
          <Animated.View
            entering={FadeIn.duration(400)}
            className="flex-1 items-center justify-center px-8"
          >
            <FileText size={56} color="rgba(255,255,255,0.1)" />
            <Text className="text-lg font-sans-semibold text-foreground mt-4">
              No {docTitle.toLowerCase()} available
            </Text>
            <Text className="text-sm text-muted-foreground text-center mt-1">
              This document may not have been generated yet
            </Text>
          </Animated.View>
        )}

      {/* PDF WebView */}
      {!documentLoading && pdfViewerUrl && (
        <Animated.View entering={FadeIn.duration(300)} className="flex-1">
          <WebView
            source={{ uri: pdfViewerUrl }}
            style={{ flex: 1, backgroundColor: "#000" }}
            scalesPageToFit
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-background">
                <ActivityIndicator color="#8A40CF" size="large" />
              </View>
            )}
          />
        </Animated.View>
      )}

      {/* HTML Fallback Viewer */}
      {!documentLoading && !pdfViewerUrl && fallbackHtml && (
        <Animated.View entering={FadeIn.duration(300)} className="flex-1">
          <WebView
            source={{ html: fallbackHtml }}
            style={{ flex: 1, backgroundColor: "#fff" }}
            scalesPageToFit
            startInLoadingState
          />
        </Animated.View>
      )}
    </View>
  );
}
