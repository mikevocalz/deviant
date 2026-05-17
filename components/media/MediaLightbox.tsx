/**
 * MediaLightbox — temporary drop-in for @nandorojo/galeria.
 *
 * Galeria's native UIView gestureRecognizer doesn't fire on iOS 26 in
 * SDK 56 preview.12 — same family as the other native-bridge regressions
 * we hit today (expo-localization, Location.reverseGeocodeAsync). Until
 * upstream Galeria ships an iOS 26 fix this provides equivalent behavior
 * using stack JS-only components:
 *
 *   - `@gorhom/bottom-sheet` for the fullscreen modal surface
 *   - `expo-image` (or DVNTGifView for gif posts) for the image
 *   - horizontal paged `ScrollView` for multi-image / gif posts
 *
 * API matches Galeria's surface so callers swap with `as Galeria`:
 *   <MediaLightbox urls={[...]}>            // string urls
 *   <MediaLightbox media={[...]}>            // typed media items (mixed image/gif)
 *     <MediaLightbox.Image index={i}>
 *       <YourThumbnail />
 *     </MediaLightbox.Image>
 *   </MediaLightbox>
 *
 * Tap on any <MediaLightbox.Image> opens the sheet at that index.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { DVNTGifView } from "./DVNTGifView";

type LightboxMedia = {
  type?: "image" | "gif" | "livePhoto" | string;
  url: string;
};

interface LightboxContextValue {
  items: LightboxMedia[];
  open: (index: number) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

interface LightboxProps {
  /** Galeria-compatible: string urls (treated as images). */
  urls?: string[];
  /** Optional typed media items — preferred when the post has GIFs mixed in. */
  media?: LightboxMedia[];
  children: React.ReactNode;
}

function LightboxProvider({ urls, media, children }: LightboxProps) {
  const items: LightboxMedia[] = useMemo(() => {
    if (media && media.length) return media;
    return (urls ?? [])
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .map((url) => ({ type: "image" as const, url }));
  }, [urls, media]);

  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const open = useCallback(
    (index: number) => {
      if (!items.length) return;
      setOpenIndex(Math.max(0, Math.min(index, items.length - 1)));
      requestAnimationFrame(() => sheetRef.current?.snapToIndex(0));
    },
    [items.length],
  );

  const close = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) setOpenIndex(null);
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const value = useMemo(() => ({ items, open }), [items, open]);
  const screenWidth = Dimensions.get("window").width;

  return (
    <LightboxContext.Provider value={value}>
      {children}
      {openIndex !== null ? (
        <BottomSheet
          ref={sheetRef}
          snapPoints={["100%"]}
          index={0}
          enablePanDownToClose
          enableOverDrag={false}
          onChange={handleSheetChange}
          handleComponent={null}
          backgroundStyle={styles.sheetBg}
          backdropComponent={renderBackdrop}
          style={styles.sheet}
        >
          <BottomSheetView style={styles.sheetContent}>
            <Pressable
              onPress={close}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close media viewer"
            >
              <X size={26} color="#fff" />
            </Pressable>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: openIndex * screenWidth, y: 0 }}
            >
              {items.map((item, i) => (
                <View
                  key={`${item.url}-${i}`}
                  style={[styles.page, { width: screenWidth }]}
                >
                  {item.type === "gif" ? (
                    <DVNTGifView
                      uri={item.url}
                      width="100%"
                      height="100%"
                      contentFit="contain"
                    />
                  ) : (
                    <Image
                      source={{ uri: item.url }}
                      style={styles.image}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </BottomSheetView>
        </BottomSheet>
      ) : null}
    </LightboxContext.Provider>
  );
}

interface LightboxImageProps {
  index: number;
  children: React.ReactElement;
  /** Galeria-compat passthrough props (ignored for now). */
  edgeToEdge?: boolean;
}

function LightboxImage({ index, children }: LightboxImageProps) {
  const ctx = useContext(LightboxContext);
  const onPress = useCallback(() => ctx?.open(index), [ctx, index]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

// Galeria-compatible namespaced export: `<MediaLightbox.Image>`.
export const MediaLightbox = LightboxProvider as typeof LightboxProvider & {
  Image: typeof LightboxImage;
};
MediaLightbox.Image = LightboxImage;

const styles = StyleSheet.create({
  sheet: { zIndex: 10000, elevation: 10000 },
  sheetBg: { backgroundColor: "#000" },
  sheetContent: { flex: 1, backgroundColor: "#000" },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  page: { height: "100%", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
});
