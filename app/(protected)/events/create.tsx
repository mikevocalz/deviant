import { useEffect, useCallback, useMemo } from "react";
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
  Globe,
  Shield,
  Wifi,
  Shirt,
  DoorOpen,
  Music,
  Gift,
  UserPlus,
  Trash2,
  ChevronDown,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme, useMediaPicker } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
import { useCreateEventStore } from "@/lib/stores/create-event-store";
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
import {
  ticketTypesApi,
  type CreateTicketTypeParams,
} from "@/lib/api/ticket-types";
import { YouTubeEmbed, extractVideoId } from "@/components/youtube-embed";

type VisibilityOption = "public" | "private" | "link_only";
type AgeRestriction = "none" | "18+" | "21+";

interface TicketTier {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  maxPerUser: number;
  description: string;
  saleStart: string;
  saleEnd: string;
}

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

  // All form state from Zustand (MMKV-persisted draft)
  const store = useCreateEventStore();
  const {
    title,
    setTitle,
    description,
    setDescription,
    location,
    setLocation,
    locationData,
    setLocationData,
    eventImages,
    setEventImages,
    tags,
    toggleTag,
    customTag,
    setCustomTag,
    addCustomTag,
    eventDate: eventDateISO,
    setEventDate: setEventDateISO,
    endDate: endDateISO,
    setEndDate: setEndDateISO,
    ticketPrice,
    setTicketPrice,
    maxAttendees,
    setMaxAttendees,
    youtubeUrl,
    setYoutubeUrl,
    isSubmitting,
    setIsSubmitting,
    uploadProgress,
    setUploadProgress,
    ticketingEnabled,
    setTicketingEnabled,
    ticketTierName,
    setTicketTierName,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    showEndTimePicker,
    setShowEndTimePicker,
    visibility,
    setVisibility,
    ageRestriction,
    setAgeRestriction,
    isOnline,
    setIsOnline,
    dressCode,
    setDressCode,
    doorPolicy,
    setDoorPolicy,
    lineup,
    setLineup,
    lineupInput,
    setLineupInput,
    perks,
    setPerks,
    perksInput,
    setPerksInput,
    ticketTiers,
    setTicketTiers,
    addLineupItem,
    addPerk,
    resetDraft,
  } = store;

  // Convert ISO strings to Date objects for pickers
  const eventDate = useMemo(() => new Date(eventDateISO), [eventDateISO]);
  const endDate = useMemo(
    () => (endDateISO ? new Date(endDateISO) : null),
    [endDateISO],
  );

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
      setEventDateISO(newDate.toISOString());
    }
  };

  const handleTimeChange = (event: unknown, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(eventDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEventDateISO(newDate.toISOString());
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

      const eventData: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        date: eventDateISO,
        time: formatTime(eventDate),
        location: location.trim(),
        price: ticketPrice ? parseFloat(ticketPrice) : 0,
        image: mainEventImageUrl,
        images: additionalImageUrls.map((url) => ({ type: "image", url })),
        category: tags[0] || "Event",
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        youtubeVideoUrl: youtubeUrl.trim() || undefined,
        // V2 fields — location coordinates from autocomplete
        locationLat: locationData?.latitude,
        locationLng: locationData?.longitude,
        locationName: locationData?.name,
        locationType: isOnline ? "virtual" : "physical",
        isOnline,
        ticketingEnabled,
        // V2 fields — new
        endDate: endDateISO || undefined,
        visibility,
        ageRestriction: ageRestriction !== "none" ? ageRestriction : undefined,
        dressCode: dressCode.trim() || undefined,
        doorPolicy: doorPolicy.trim() || undefined,
        lineup: lineup.length > 0 ? lineup : undefined,
        perks: perks.length > 0 ? perks : undefined,
      };

      console.log("[CreateEvent] Creating event with data:", eventData);

      createEvent.mutate(eventData, {
        onSuccess: async (data) => {
          console.log("[CreateEvent] Event created successfully:", data);

          // Create ticket types if ticketing is enabled
          if (ticketingEnabled && data?.id) {
            if (ticketTiers.length > 0) {
              // Multi-tier: create each tier
              for (const tier of ticketTiers) {
                await ticketTypesApi.create({
                  eventId: String(data.id),
                  name: tier.name,
                  description: tier.description || undefined,
                  priceCents: tier.priceCents,
                  quantityTotal: tier.quantity,
                  maxPerUser: tier.maxPerUser,
                  saleStart: tier.saleStart || undefined,
                  saleEnd: tier.saleEnd || undefined,
                });
              }
              console.log(
                "[CreateEvent] Created",
                ticketTiers.length,
                "ticket tiers",
              );
            } else {
              // Fallback: single default tier
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
          }

          setUploadProgress(100);
          showToast("success", "Success", "Event created successfully!");
          resetDraft();
          router.back();
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
              setShowDatePicker(!showDatePicker);
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
              setShowTimePicker(!showTimePicker);
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

          {/* End Date toggle + pickers */}
          {!endDate ? (
            <Pressable
              onPress={() => {
                const d = new Date(eventDate);
                d.setHours(d.getHours() + 3);
                setEndDateISO(d.toISOString());
              }}
              className="flex-row items-center gap-2 mt-3 px-1"
            >
              <Plus size={16} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">
                Add End Date & Time
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setShowEndDatePicker(!showEndDatePicker);
                  setShowEndTimePicker(false);
                }}
                className="flex-row items-center bg-card rounded-2xl p-4 gap-3 mt-3"
              >
                <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                  <Calendar size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-0.5">
                    End Date
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatDate(endDate)}
                  </Text>
                </View>
                <Pressable onPress={() => setEndDateISO(null)} hitSlop={12}>
                  <X size={16} color={colors.mutedForeground} />
                </Pressable>
              </Pressable>

              {showEndDatePicker && (
                <View className="bg-card rounded-2xl mt-3 overflow-hidden">
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_e: unknown, d?: Date) => {
                      if (Platform.OS === "android")
                        setShowEndDatePicker(false);
                      if (d) {
                        const nd = new Date(endDate!);
                        nd.setFullYear(
                          d.getFullYear(),
                          d.getMonth(),
                          d.getDate(),
                        );
                        setEndDateISO(nd.toISOString());
                      }
                    }}
                    minimumDate={eventDate}
                    themeVariant="dark"
                    style={{ width: "100%" }}
                  />
                </View>
              )}

              <Pressable
                onPress={() => {
                  setShowEndTimePicker(!showEndTimePicker);
                  setShowEndDatePicker(false);
                }}
                className="flex-row items-center bg-card rounded-2xl p-4 gap-3 mt-3"
              >
                <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                  <Clock size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-0.5">
                    End Time
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatTime(endDate)}
                  </Text>
                </View>
              </Pressable>

              {showEndTimePicker && (
                <View className="bg-card rounded-2xl mt-3 overflow-hidden">
                  <DateTimePicker
                    value={endDate}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_e: unknown, t?: Date) => {
                      if (Platform.OS === "android")
                        setShowEndTimePicker(false);
                      if (t) {
                        const nd = new Date(endDate!);
                        nd.setHours(t.getHours(), t.getMinutes());
                        setEndDateISO(nd.toISOString());
                      }
                    }}
                    themeVariant="dark"
                    style={{ width: "100%" }}
                  />
                </View>
              )}
            </>
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

        {/* Event Settings — Visibility, Age, Virtual */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Event Settings
          </Text>

          {/* Virtual / Online toggle */}
          <View className="flex-row items-center justify-between bg-card rounded-2xl p-4 mb-3">
            <View className="flex-row items-center gap-3 flex-1 mr-3">
              <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                <Wifi size={18} color={colors.primary} />
              </View>
              <View>
                <Text className="text-sm font-semibold text-foreground">
                  Virtual Event
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Online-only, no physical venue
                </Text>
              </View>
            </View>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: "#333", true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Visibility */}
          <View className="bg-card rounded-2xl p-4 mb-3">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                <Globe size={18} color={colors.primary} />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                Visibility
              </Text>
            </View>
            <View className="flex-row gap-2">
              {(["public", "private", "link_only"] as VisibilityOption[]).map(
                (opt) => {
                  const labels: Record<VisibilityOption, string> = {
                    public: "Public",
                    private: "Private",
                    link_only: "Link Only",
                  };
                  const isActive = visibility === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setVisibility(opt)}
                      className="flex-1 py-2.5 rounded-xl items-center"
                      style={{
                        backgroundColor: isActive
                          ? `${colors.primary}20`
                          : "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: isActive
                          ? `${colors.primary}60`
                          : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{
                          color: isActive
                            ? colors.primary
                            : colors.mutedForeground,
                        }}
                      >
                        {labels[opt]}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>

          {/* Age Restriction */}
          <View className="bg-card rounded-2xl p-4">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                <Shield size={18} color={colors.primary} />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                Age Restriction
              </Text>
            </View>
            <View className="flex-row gap-2">
              {(["none", "18+", "21+"] as AgeRestriction[]).map((opt) => {
                const labels: Record<AgeRestriction, string> = {
                  none: "All Ages",
                  "18+": "18+",
                  "21+": "21+",
                };
                const isActive = ageRestriction === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setAgeRestriction(opt)}
                    className="flex-1 py-2.5 rounded-xl items-center"
                    style={{
                      backgroundColor: isActive
                        ? `${colors.primary}20`
                        : "rgba(255,255,255,0.04)",
                      borderWidth: 1,
                      borderColor: isActive
                        ? `${colors.primary}60`
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: isActive
                          ? colors.primary
                          : colors.mutedForeground,
                      }}
                    >
                      {labels[opt]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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

        {/* Enrichment Fields — Dress Code, Door Policy, Lineup, Perks */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Event Details (Optional)
          </Text>

          {/* Dress Code */}
          <View className="flex-row items-center bg-card rounded-2xl px-4 mb-3">
            <Shirt size={18} color={colors.mutedForeground} />
            <TextInput
              className="flex-1 ml-3 py-4 text-base text-foreground"
              placeholder="Dress code (e.g. Smart Casual)"
              placeholderTextColor={colors.mutedForeground}
              value={dressCode}
              onChangeText={setDressCode}
            />
          </View>

          {/* Door Policy */}
          <View className="flex-row items-center bg-card rounded-2xl px-4 mb-3">
            <DoorOpen size={18} color={colors.mutedForeground} />
            <TextInput
              className="flex-1 ml-3 py-4 text-base text-foreground"
              placeholder="Door policy (e.g. Guest list only)"
              placeholderTextColor={colors.mutedForeground}
              value={doorPolicy}
              onChangeText={setDoorPolicy}
            />
          </View>

          {/* Lineup */}
          <View className="bg-card rounded-2xl p-4 mb-3">
            <View className="flex-row items-center gap-2 mb-3">
              <Music size={18} color={colors.mutedForeground} />
              <Text className="text-sm font-semibold text-foreground">
                Lineup / Performers
              </Text>
            </View>
            {lineup.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {lineup.map((performer, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full"
                  >
                    <Text className="text-sm text-foreground">{performer}</Text>
                    <Pressable
                      onPress={() =>
                        setLineup((p) => p.filter((_, i) => i !== idx))
                      }
                      hitSlop={8}
                    >
                      <X size={12} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 py-2.5 text-base text-foreground"
                placeholder="Add performer name..."
                placeholderTextColor={colors.mutedForeground}
                value={lineupInput}
                onChangeText={setLineupInput}
                onSubmitEditing={addLineupItem}
                returnKeyType="done"
              />
              {lineupInput.trim() !== "" && (
                <Pressable onPress={addLineupItem} className="p-2">
                  <Plus size={20} color={colors.primary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Perks */}
          <View className="bg-card rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Gift size={18} color={colors.mutedForeground} />
              <Text className="text-sm font-semibold text-foreground">
                Perks / What's Included
              </Text>
            </View>
            {perks.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {perks.map((perk, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full"
                  >
                    <Text className="text-sm text-foreground">{perk}</Text>
                    <Pressable
                      onPress={() =>
                        setPerks((p) => p.filter((_, i) => i !== idx))
                      }
                      hitSlop={8}
                    >
                      <X size={12} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 py-2.5 text-base text-foreground"
                placeholder="Add perk (e.g. Open bar, VIP access)"
                placeholderTextColor={colors.mutedForeground}
                value={perksInput}
                onChangeText={setPerksInput}
                onSubmitEditing={addPerk}
                returnKeyType="done"
              />
              {perksInput.trim() !== "" && (
                <Pressable onPress={addPerk} className="p-2">
                  <Plus size={20} color={colors.primary} />
                </Pressable>
              )}
            </View>
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
            <>
              {/* Default single tier name (used if no multi-tiers added) */}
              {ticketTiers.length === 0 && (
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

              {/* Multi-tier ticket list */}
              {ticketTiers.map((tier, idx) => (
                <View key={tier.id} className="bg-card rounded-2xl p-4 mb-3">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm font-semibold text-foreground">
                      Tier {idx + 1}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setTicketTiers((prev) =>
                          prev.filter((t) => t.id !== tier.id),
                        )
                      }
                      hitSlop={12}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </View>

                  <TextInput
                    className="bg-muted rounded-xl px-4 py-3 text-base text-foreground mb-2"
                    placeholder="Tier name (e.g. VIP, Early Bird)"
                    placeholderTextColor={colors.mutedForeground}
                    value={tier.name}
                    onChangeText={(v) =>
                      setTicketTiers((prev) =>
                        prev.map((t) =>
                          t.id === tier.id ? { ...t, name: v } : t,
                        ),
                      )
                    }
                  />

                  <TextInput
                    className="bg-muted rounded-xl px-4 py-3 text-base text-foreground mb-2"
                    placeholder="Description (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    value={tier.description}
                    onChangeText={(v) =>
                      setTicketTiers((prev) =>
                        prev.map((t) =>
                          t.id === tier.id ? { ...t, description: v } : t,
                        ),
                      )
                    }
                  />

                  <View className="flex-row gap-2 mb-2">
                    <View className="flex-1 flex-row items-center bg-muted rounded-xl px-3">
                      <DollarSign size={14} color={colors.mutedForeground} />
                      <TextInput
                        className="flex-1 ml-2 py-3 text-sm text-foreground"
                        placeholder="Price"
                        placeholderTextColor={colors.mutedForeground}
                        value={
                          tier.priceCents > 0
                            ? (tier.priceCents / 100).toString()
                            : ""
                        }
                        onChangeText={(v) =>
                          setTicketTiers((prev) =>
                            prev.map((t) =>
                              t.id === tier.id
                                ? {
                                    ...t,
                                    priceCents: v
                                      ? Math.round(parseFloat(v) * 100)
                                      : 0,
                                  }
                                : t,
                            ),
                          )
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View className="flex-1 flex-row items-center bg-muted rounded-xl px-3">
                      <Users size={14} color={colors.mutedForeground} />
                      <TextInput
                        className="flex-1 ml-2 py-3 text-sm text-foreground"
                        placeholder="Quantity"
                        placeholderTextColor={colors.mutedForeground}
                        value={
                          tier.quantity > 0 ? tier.quantity.toString() : ""
                        }
                        onChangeText={(v) =>
                          setTicketTiers((prev) =>
                            prev.map((t) =>
                              t.id === tier.id
                                ? { ...t, quantity: v ? parseInt(v, 10) : 0 }
                                : t,
                            ),
                          )
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-1 flex-row items-center bg-muted rounded-xl px-3">
                      <TextInput
                        className="flex-1 py-3 text-sm text-foreground"
                        placeholder="Max/user"
                        placeholderTextColor={colors.mutedForeground}
                        value={
                          tier.maxPerUser > 0 ? tier.maxPerUser.toString() : ""
                        }
                        onChangeText={(v) =>
                          setTicketTiers((prev) =>
                            prev.map((t) =>
                              t.id === tier.id
                                ? { ...t, maxPerUser: v ? parseInt(v, 10) : 4 }
                                : t,
                            ),
                          )
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Add tier button */}
              <Pressable
                onPress={() =>
                  setTicketTiers((prev) => [
                    ...prev,
                    {
                      id: `tier-${Date.now()}`,
                      name: "",
                      priceCents: 0,
                      quantity: 100,
                      maxPerUser: 4,
                      description: "",
                      saleStart: "",
                      saleEnd: "",
                    },
                  ])
                }
                className="flex-row items-center justify-center gap-2 bg-card rounded-2xl p-4 mb-3 border border-dashed border-border"
              >
                <Plus size={16} color={colors.primary} />
                <Text className="text-sm font-semibold text-primary">
                  {ticketTiers.length === 0
                    ? "Add Multiple Ticket Tiers"
                    : "Add Another Tier"}
                </Text>
              </Pressable>
            </>
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
