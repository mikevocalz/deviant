import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme, useMediaPicker } from "@/lib/hooks";

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
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const { pickFromLibrary, requestPermissions } = useMediaPicker();
  const createEvent = useCreateEvent();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(eventDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setEventDate(newDate);
    }
  };

  const handleTimeChange = (event: unknown, selectedTime?: Date) => {
    setShowTimePicker(false);
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
    if (!title.trim()) {
      Alert.alert("Error", "Please enter an event title");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please enter an event description");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Error", "Please enter a location");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    // Upload images to Bunny.net CDN
    let uploadedImageUrl = "";
    if (eventImages.length > 0) {
      const mediaFiles = eventImages.map((uri) => ({
        uri,
        type: "image" as const,
      }));

      const uploadResults = await uploadMultiple(mediaFiles);
      const failedUploads = uploadResults.filter((r) => !r.success);

      if (failedUploads.length > 0) {
        setIsSubmitting(false);
        Alert.alert(
          "Upload Error",
          "Failed to upload images. Please try again.",
        );
        return;
      }

      uploadedImageUrl = uploadResults[0]?.url || "";
    }

    createEvent.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        fullDate: eventDate,
        time: formatTime(eventDate),
        location: location.trim(),
        price: ticketPrice ? parseFloat(ticketPrice) : 0,
        image: uploadedImageUrl,
        category: tags[0] || "Event",
      },
      {
        onSuccess: () => {
          setUploadProgress(100);
          setTimeout(() => {
            setIsSubmitting(false);
            router.back();
          }, 300);
        },
        onError: (error) => {
          setIsSubmitting(false);
          console.error("Error creating event:", error);
          Alert.alert("Error", "Failed to create event. Please try again.");
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Create Event",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: "700" },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <X size={24} color={colors.foreground} />
            </Pressable>
          ),
          headerRight: () => (
            <Motion.View whileTap={{ scale: 0.95 }}>
              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting || !isValid}
                className={`px-4 py-2 rounded-2xl ${isValid ? "bg-primary" : "bg-muted"}`}
              >
                <Text
                  className={`text-sm font-semibold ${isValid ? "text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </Text>
              </Pressable>
            </Motion.View>
          ),
        }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="flex-1 flex-row items-center bg-card rounded-2xl p-4 gap-3"
              >
                <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                  <Calendar size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-0.5">
                    Date
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatDate(eventDate)}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="flex-1 flex-row items-center bg-card rounded-2xl p-4 gap-3"
              >
                <View className="w-10 h-10 rounded-xl bg-muted items-center justify-center">
                  <Clock size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-0.5">
                    Time
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatTime(eventDate)}
                  </Text>
                </View>
              </Pressable>
            </View>
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
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={eventDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          minimumDate={new Date()}
          themeVariant="dark"
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={eventDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
          themeVariant="dark"
        />
      )}

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
    </View>
  );
}
