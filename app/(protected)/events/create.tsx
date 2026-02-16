import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Switch,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { useRouter, useNavigation } from "expo-router";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { useLayoutEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Image as ImageIcon,
  Tag,
  FileText,
  Ticket,
  DollarSign,
  Users,
  Plus,
  Youtube,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme, useMediaPicker } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
// Popover removed — inline expanding pickers used instead

// Conditionally import expo-maps (requires dev build, not available in Expo Go)
let AppleMaps: typeof import("expo-maps").AppleMaps | null = null;
let GoogleMaps: typeof import("expo-maps").GoogleMaps | null = null;
try {
  const expoMaps = require("expo-maps");
  AppleMaps = expoMaps.AppleMaps;
  GoogleMaps = expoMaps.GoogleMaps;
} catch {
  // expo-maps not available (e.g., in Expo Go)
}
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { Motion } from "@legendapp/motion";
import { Badge } from "@/components/ui/badge";
import { Text as UIText } from "@/components/ui/text";
import { Progress } from "@/components/ui/progress";
import {
  LocationAutocomplete,
  type LocationData,
} from "@/components/ui/location-autocomplete";
import { useCreateEvent } from "@/lib/hooks/use-events";
import { ticketTypesApi } from "@/lib/api/ticket-types";
import { YouTubeEmbed, extractVideoId } from "@/components/youtube-embed";

const SUGGESTED_TAGS = [
  "music",
  "tech",
  "networking",
  "food",
  "art",
  "sports",
  "nightlife",
  "wellness",
  "education",
  "charity",
];

export default function CreateEventScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const { pickFromLibrary, requestPermissions } = useMediaPicker();
  const createEvent = useCreateEvent();
  const showToast = useUIStore((s) => s.showToast);
  const {
    uploadMultiple,
    isUploading: isUploadingMedia,
    progress: mediaUploadProgress,
  } = useMediaUpload({ folder: "events" });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [eventImages, setEventImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [ticketPrice, setTicketPrice] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ticketingEnabled, setTicketingEnabled] = useState(false);
  const [ticketTierName, setTicketTierName] = useState("");

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const handlePickImages = async () => {
    const remaining = 4 - eventImages.length;
    if (remaining <= 0) return;

    const result = await pickFromLibrary({
      maxSelection: remaining,
      allowsMultipleSelection: remaining > 1,
    });
    if (result && result.length > 0) {
      setEventImages((prev) =>
        [...prev, ...result.map((r) => r.uri)].slice(0, 4),
      );
    }
  };

  const removeImage = (index: number) => {
    setEventImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(eventDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setEventDate(newDate);
    }
  };

  const handleTimeChange = (event: unknown, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(eventDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEventDate(newDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const isValid = title.trim() && description.trim() && location.trim();

  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmitting || createEvent.isPending) {
      console.log("[CreateEvent] Already submitting, ignoring");
      return;
    }

    if (!title.trim()) {
      showToast("error", "Error", "Please enter an event title");
      return;
    }
    if (!description.trim()) {
      showToast("error", "Error", "Please enter an event description");
      return;
    }
    if (!location.trim()) {
      showToast("error", "Error", "Please enter a location");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Upload main event image (first image) and additional images to Bunny.net CDN
      let mainEventImageUrl = "";
      let additionalImageUrls: string[] = [];

      if (eventImages.length > 0) {
        const mediaFiles = eventImages.map((uri) => ({
          uri,
          type: "image" as const,
        }));

        console.log("[CreateEvent] Uploading media files:", mediaFiles.length);
        const uploadResults = await uploadMultiple(mediaFiles);
        const failedUploads = uploadResults.filter((r) => !r.success);

        if (failedUploads.length > 0) {
          setIsSubmitting(false);
          console.error("[CreateEvent] Upload failures:", failedUploads);
          showToast(
            "error",
            "Upload Error",
            "Failed to upload images. Please try again.",
          );
          return;
        }

        // First image is the main event image
        mainEventImageUrl = uploadResults[0]?.url || "";
        // Remaining images are additional images
        additionalImageUrls = uploadResults
          .slice(1)
          .map((r) => r.url)
          .filter(Boolean);
        console.log(
          "[CreateEvent] Upload successful - Main:",
          mainEventImageUrl,
          "Additional:",
          additionalImageUrls.length,
        );
      }

      // Format date as ISO string for Payload
      const eventDateISO = eventDate.toISOString();

      const eventData: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        date: eventDateISO, // Use 'date' field (not 'fullDate')
        time: formatTime(eventDate),
        location: location.trim(),
        price: ticketPrice ? parseFloat(ticketPrice) : 0,
        image: mainEventImageUrl, // Main event image
        images: additionalImageUrls.map((url) => ({ type: "image", url })), // Additional images array
        category: tags[0] || "Event",
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        youtubeVideoUrl: youtubeUrl.trim() || undefined,
        // V2 fields — location coordinates from autocomplete
        locationLat: locationData?.latitude,
        locationLng: locationData?.longitude,
        locationName: locationData?.name,
        locationType: "physical",
        ticketingEnabled,
      };

      console.log("[CreateEvent] Creating event with data:", eventData);

      createEvent.mutate(eventData, {
        onSuccess: async (data) => {
          console.log("[CreateEvent] Event created successfully:", data);

          // Create default ticket type if ticketing is enabled
          if (ticketingEnabled && data?.id) {
            const priceCents = ticketPrice
              ? Math.round(parseFloat(ticketPrice) * 100)
              : 0;
            const qty = maxAttendees ? parseInt(maxAttendees, 10) : 200;
            const tierName =
              ticketTierName.trim() ||
              (priceCents === 0 ? "Free" : "General Admission");
            await ticketTypesApi.create({
              eventId: String(data.id),
              name: tierName,
              priceCents,
              quantityTotal: qty,
              maxPerUser: 4,
            });
            console.log("[CreateEvent] Default ticket type created");
          }

          setUploadProgress(100);
          showToast("success", "Success", "Event created successfully!");
          setTimeout(() => {
            setIsSubmitting(false);
            router.back();
          }, 300);
        },
        onError: (error: any) => {
          setIsSubmitting(false);
          console.error("[CreateEvent] Error creating event:", error);
          console.error(
            "[CreateEvent] Error details:",
            JSON.stringify(error, null, 2),
          );
          const errorMessage =
            error?.message ||
            error?.error?.message ||
            "Failed to create event. Please try again.";
          showToast("error", "Error", errorMessage);
        },
      });
    } catch (error: any) {
      setIsSubmitting(false);
      console.error("[CreateEvent] Unexpected error:", error);
      showToast(
        "error",
        "Error",
        "An unexpected error occurred. Please try again.",
      );
    }
  };

  // Set up header with useLayoutEffect
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "Create Event",
      headerTitleAlign: "left" as const,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600" as const,
        fontSize: 18,
      },
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{
            marginLeft: 8,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={24} color={colors.foreground} strokeWidth={2.5} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => {
            console.log(
              "[CreateEvent] Create button pressed, isValid:",
              isValid,
              "isSubmitting:",
              isSubmitting,
            );
            if (!isSubmitting && isValid) {
              handleSubmit();
            } else if (!isValid) {
              // Show which fields are missing
              if (!title.trim()) {
                showToast(
                  "warning",
                  "Missing Title",
                  "Please enter an event title",
                );
              } else if (!description.trim()) {
                showToast(
                  "warning",
                  "Missing Description",
                  "Please enter an event description",
                );
              } else if (!location.trim()) {
                showToast(
                  "warning",
                  "Missing Location",
                  "Please enter a location",
                );
              }
            }
          }}
          disabled={isSubmitting || !isValid}
          hitSlop={12}
          style={{ marginRight: 8 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color:
                isValid && !isSubmitting
                  ? colors.primary
                  : colors.mutedForeground,
            }}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </Text>
        </Pressable>
      ),
    });
  }, [
    navigation,
    colors,
    isValid,
    isSubmitting,
    title,
    description,
    location,
    handleSubmit,
    showToast,
    router,
  ]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={100}
        enabled={true}
      >
        {/* Title & Description */}
        <View className="mb-6">
          <View className="flex-row items-center bg-card rounded-2xl px-4 mb-3">
            <FileText size={20} color={colors.primary} />
            <TextInput
              className="flex-1 ml-3 py-4 text-lg font-semibold text-foreground"
              placeholder="Event Title"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
          </View>

          <View className="bg-card rounded-2xl p-4">
            <TextInput
              className="text-base text-foreground min-h-[100px]"
              placeholder="Describe your event... What will attendees experience?"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
            />
            <Text className="text-xs text-muted-foreground text-right mt-2">
              {description.length}/2000
            </Text>
          </View>
        </View>

        {/* Date & Time */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Date & Time
          </Text>

          {/* Date row */}
          <Pressable
            onPress={() => {
              setShowDatePicker((v) => !v);
              setShowTimePicker(false);
            }}
            className="flex-row items-center bg-card rounded-2xl p-4 gap-3 mb-3"
          >
            <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
              <Calendar size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-0.5">Date</Text>
              <Text className="text-sm font-semibold text-foreground">
                {formatDate(eventDate)}
              </Text>
            </View>
          </Pressable>

          {showDatePicker && (
            <View className="bg-card rounded-2xl mb-3 overflow-hidden">
              <DateTimePicker
                value={eventDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                minimumDate={new Date()}
                themeVariant="dark"
                style={{ width: "100%" }}
              />
            </View>
          )}

          {/* Time row */}
          <Pressable
            onPress={() => {
              setShowTimePicker((v) => !v);
              setShowDatePicker(false);
            }}
            className="flex-row items-center bg-card rounded-2xl p-4 gap-3"
          >
            <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
              <Clock size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-0.5">Time</Text>
              <Text className="text-sm font-semibold text-foreground">
                {formatTime(eventDate)}
              </Text>
            </View>
          </Pressable>

          {showTimePicker && (
            <View className="bg-card rounded-2xl mt-3 overflow-hidden">
              <DateTimePicker
                value={eventDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
                themeVariant="dark"
                style={{ width: "100%" }}
              />
            </View>
          )}
        </View>

        {/* Location */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Location
          </Text>
          <LocationAutocomplete
            value={location}
            placeholder="Search venue or address"
            onLocationSelect={(data: LocationData) => {
              setLocation(data.name);
              setLocationData(data);
            }}
            onTextChange={(text: string) => {
              // Update location as user types (enables form validation)
              setLocation(text);
              // Clear coordinates since we only have text, not a selected place
              if (!text) {
                setLocationData(null);
              }
            }}
            onClear={() => {
              setLocation("");
              setLocationData(null);
            }}
          />

          {locationData?.latitude && locationData?.longitude && (
            <View
              className="mt-3 rounded-2xl overflow-hidden"
              style={{ height: 180 }}
            >
              {Platform.OS === "ios" ? (
                AppleMaps ? (
                  <AppleMaps.View
                    style={{ flex: 1 }}
                    cameraPosition={{
                      coordinates: {
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                      },
                      zoom: 15,
                    }}
                    markers={[
                      {
                        id: "event-location",
                        coordinates: {
                          latitude: locationData.latitude,
                          longitude: locationData.longitude,
                        },
                      },
                    ]}
                  />
                ) : (
                  <View className="flex-1 bg-muted items-center justify-center">
                    <Text className="text-muted-foreground text-sm">
                      Map preview requires dev build
                    </Text>
                  </View>
                )
              ) : Platform.OS === "android" ? (
                GoogleMaps ? (
                  <GoogleMaps.View
                    style={{ flex: 1 }}
                    cameraPosition={{
                      coordinates: {
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                      },
                      zoom: 15,
                    }}
                    markers={[
                      {
                        id: "event-location",
                        coordinates: {
                          latitude: locationData.latitude,
                          longitude: locationData.longitude,
                        },
                      },
                    ]}
                  />
                ) : (
                  <View className="flex-1 bg-muted items-center justify-center">
                    <Text className="text-muted-foreground text-sm">
                      Map preview requires dev build
                    </Text>
                  </View>
                )
              ) : (
                <View className="flex-1 bg-muted items-center justify-center">
                  <Text className="text-muted-foreground text-sm">
                    Maps only available on iOS and Android
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* YouTube Video URL */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            YouTube Video (Optional)
          </Text>
          <View className="flex-row items-center bg-card rounded-2xl px-4">
            <Youtube size={20} color={colors.primary} />
            <TextInput
              className="flex-1 ml-3 py-4 text-base text-foreground"
              placeholder="Paste YouTube URL or video ID"
              placeholderTextColor={colors.mutedForeground}
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {youtubeUrl.trim() !== "" && (
              <Pressable onPress={() => setYoutubeUrl("")} className="p-2">
                <X size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Live YouTube preview */}
          {youtubeUrl.trim() !== "" && extractVideoId(youtubeUrl.trim()) && (
            <View className="mt-3">
              <YouTubeEmbed url={youtubeUrl.trim()} height={200} />
            </View>
          )}
        </View>

        {/* Event Images */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Event Images
            </Text>
            <Text className="text-xs text-muted-foreground">
              {eventImages.length}/4
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-3">
            {eventImages.map((uri, index) => (
              <View
                key={uri}
                className="relative rounded-2xl overflow-hidden"
                style={{ width: "48%", aspectRatio: 1 }}
              >
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
                <Pressable
                  onPress={() => removeImage(index)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 items-center justify-center"
                >
                  <X size={16} color="#fff" />
                </Pressable>
                {index === 0 && (
                  <View className="absolute bottom-2 left-2 bg-primary px-2 py-1 rounded-lg">
                    <Text className="text-xs font-medium text-primary-foreground">
                      Cover
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {eventImages.length < 4 && (
              <Pressable
                onPress={handlePickImages}
                className="bg-card rounded-2xl items-center justify-center border-2 border-dashed border-border"
                style={{
                  width: "48%",
                  aspectRatio: 1,
                  justifyContent: "center",
                }}
              >
                <View className="items-center justify-center gap-2 mb-8">
                  <View className="w-12 h-12 rounded-xl bg-muted items-center justify-center">
                    <Plus size={24} color={colors.mutedForeground} />
                  </View>
                  <Text className="text-xs text-muted-foreground font-medium">
                    Add Image
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* Tags */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Suggested Tags
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {SUGGESTED_TAGS.map((tag) => (
              <Pressable key={tag} onPress={() => toggleTag(tag)}>
                <Badge variant={tags.includes(tag) ? "default" : "outline"}>
                  <UIText>{tag}</UIText>
                </Badge>
              </Pressable>
            ))}
          </View>

          {/* Selected custom tags */}
          {tags.filter((t) => !SUGGESTED_TAGS.includes(t)).length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-3">
              {tags
                .filter((t) => !SUGGESTED_TAGS.includes(t))
                .map((tag) => (
                  <Pressable key={tag} onPress={() => toggleTag(tag)}>
                    <Badge variant="secondary">
                      <UIText>{tag}</UIText>
                      <X size={12} color={colors.secondaryForeground} />
                    </Badge>
                  </Pressable>
                ))}
            </View>
          )}

          {/* Add custom tag */}
          <View className="flex-row items-center bg-card rounded-2xl px-4 gap-2">
            <Tag size={18} color={colors.mutedForeground} />
            <TextInput
              className="flex-1 py-4 text-base text-foreground"
              placeholder="Add custom tag..."
              placeholderTextColor={colors.mutedForeground}
              value={customTag}
              onChangeText={setCustomTag}
              onSubmitEditing={addCustomTag}
              returnKeyType="done"
            />
            {customTag.trim() && (
              <Pressable onPress={addCustomTag} className="p-2">
                <Plus size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Ticketing */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Ticketing
          </Text>

          {/* Ticketing toggle */}
          <View className="flex-row items-center justify-between bg-card rounded-2xl p-4 mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-semibold text-foreground">
                Enable Paid Ticketing
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Sell tickets via Stripe (5% + $1/ticket fee)
              </Text>
            </View>
            <Switch
              value={ticketingEnabled}
              onValueChange={setTicketingEnabled}
              trackColor={{ false: "#333", true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {ticketingEnabled && (
            <View className="flex-row items-center bg-card rounded-2xl px-4 mb-3">
              <Ticket size={18} color={colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 py-4 text-base text-foreground"
                placeholder="Ticket tier name (e.g. General Admission)"
                placeholderTextColor={colors.mutedForeground}
                value={ticketTierName}
                onChangeText={setTicketTierName}
              />
            </View>
          )}

          <View className="flex-row gap-3">
            <View className="flex-1 flex-row items-center bg-card rounded-2xl px-4">
              <DollarSign size={18} color={colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 py-4 text-base text-foreground"
                placeholder="Price (0 = free)"
                placeholderTextColor={colors.mutedForeground}
                value={ticketPrice}
                onChangeText={setTicketPrice}
                keyboardType="decimal-pad"
              />
            </View>

            <View className="flex-1 flex-row items-center bg-card rounded-2xl px-4">
              <Users size={18} color={colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 py-4 text-base text-foreground"
                placeholder="Max attendees"
                placeholderTextColor={colors.mutedForeground}
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View className="flex-row bg-card rounded-2xl p-4 gap-3.5 border border-border">
          <View
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{ backgroundColor: `${colors.primary}20` }}
          >
            <Ticket size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground mb-1">
              Secure Ticketing
            </Text>
            <Text className="text-sm text-muted-foreground leading-5">
              Each ticket will be generated with a unique QR code for secure
              check-in. Attendees can add tickets to Apple Wallet or Google
              Wallet.
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Progress Overlay */}
      {isSubmitting && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
          <Motion.View
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-card rounded-3xl p-8 items-center gap-4"
          >
            <View className="w-48 mb-2">
              <Progress value={uploadProgress} />
            </View>
            <Text className="text-lg font-semibold text-foreground">
              Creating Event...
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Please wait while we set up your event
            </Text>
          </Motion.View>
        </View>
      )}
    </SafeAreaView>
  );
}
