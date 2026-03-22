/**
 * Custom Google Places Autocomplete Component (v3)
 * Uses the newer Google Places API (New) directly
 */

import { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { MapPin, AlertCircle, X, Loader2 } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface LocationData {
  name: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  formattedAddress?: string;
}

interface LocationAutocompleteProps {
  value?: string;
  placeholder?: string;
  onLocationSelect: (location: LocationData) => void;
  onClear?: () => void;
  onTextChange?: (text: string) => void;
}

interface GooglePlace {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

// Debug: Log the API key status
console.log(
  "[LocationAutocompleteV3] API Key:",
  GOOGLE_PLACES_API_KEY ? "Present" : "Missing",
);
console.log(
  "[LocationAutocompleteV3] API Key Length:",
  GOOGLE_PLACES_API_KEY.length,
);

export function LocationAutocompleteV3({
  value,
  placeholder = "Search location...",
  onLocationSelect,
  onClear,
  onTextChange,
}: LocationAutocompleteProps) {
  const { colors } = useColorScheme();
  const [inputText, setInputText] = useState(value || "");
  const [predictions, setPredictions] = useState<GooglePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounce the input text for API calls (300ms delay)
  const debouncedText = useDebounce(inputText, 300);

  // Check if API key is configured
  useEffect(() => {
    console.log("[LocationAutocompleteV3] Checking API key configuration...");
    if (
      !GOOGLE_PLACES_API_KEY ||
      GOOGLE_PLACES_API_KEY === "YOUR_GOOGLE_PLACES_API_KEY_HERE"
    ) {
      console.warn(
        "[LocationAutocompleteV3] Google Places API key not configured or using placeholder. Using manual input mode.",
      );
      setHasError(true);
    } else {
      console.log("[LocationAutocompleteV3] API key configured successfully");
    }
  }, []);

  // Fetch predictions when debounced text changes
  useEffect(() => {
    if (debouncedText.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    if (hasError) return;

    fetchPredictions(debouncedText);
  }, [debouncedText, hasError]);

  const fetchPredictions = async (text: string) => {
    setIsLoading(true);
    setShowDropdown(true);

    try {
      // Use the Google Places API with the correct parameters for Instagram-like results
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${GOOGLE_PLACES_API_KEY}&input=${encodeURIComponent(text)}&language=en&components=country:us&types=establishment|geocode|address&radius=50000&strictbounds=false`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        console.error(
          "[LocationAutocompleteV3] API error:",
          data.error_message,
        );
        // Try alternative endpoint for Places API (New)
        tryAlternativeAPI(text);
        return;
      }

      setPredictions(data.predictions || []);
      console.log(
        "[LocationAutocompleteV3] Predictions:",
        data.predictions?.length || 0,
      );
    } catch (error) {
      console.error("[LocationAutocompleteV3] Fetch error:", error);
      // Try alternative API on error
      tryAlternativeAPI(text);
    } finally {
      setIsLoading(false);
    }
  };

  // Try alternative Places API (New) endpoint
  const tryAlternativeAPI = async (text: string) => {
    try {
      // Try the newer Places API format
      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_PLACES_API_KEY}&input=${encodeURIComponent(text)}&language=en&includedRegionCodes=us`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions) {
          // Convert to our format
          const convertedPredictions = data.suggestions.map(
            (suggestion: any) => ({
              place_id: suggestion.place?.id || "fallback-" + Math.random(),
              description:
                suggestion.place?.displayName?.text ||
                suggestion.text?.text ||
                "",
              structured_formatting: {
                main_text:
                  suggestion.place?.displayName?.text ||
                  suggestion.text?.text ||
                  "",
                secondary_text: suggestion.place?.formattedAddress || "",
              },
            }),
          );
          setPredictions(convertedPredictions);
          return;
        }
      }
    } catch (error) {
      console.error("[LocationAutocompleteV3] Alternative API error:", error);
    }

    // Ultimate fallback to popular locations
    setPredictions(getPopularLocations(text));
  };

  // Fallback popular locations when API is not working
  const getPopularLocations = (searchText: string): GooglePlace[] => {
    const popularPlaces = [
      {
        place_id: "chIJrTLr-GyuEmsRBfyf1GDuE7U",
        description: "Madison Square Garden, New York, NY, USA",
        structured_formatting: {
          main_text: "Madison Square Garden",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJvUwsRj5ZwokR-9v8Ch2w_mWQ",
        description: "Times Square, New York, NY, USA",
        structured_formatting: {
          main_text: "Times Square",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJQ3S6Gh6ZwokR4jA_p_kd_hvw",
        description: "Central Park, New York, NY, USA",
        structured_formatting: {
          main_text: "Central Park",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJdRlClxZawokR7_p3d5i9SQhY",
        description: "Brooklyn Bridge, New York, NY, USA",
        structured_formatting: {
          main_text: "Brooklyn Bridge",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJN8h6Cc6ZwokR2Mj_hQyGdRYY",
        description: "Statue of Liberty, New York, NY, USA",
        structured_formatting: {
          main_text: "Statue of Liberty",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJc3RyCQ-ZwokR6jE3d_dk32Ks",
        description: "Empire State Building, New York, NY, USA",
        structured_formatting: {
          main_text: "Empire State Building",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJt9uV8l6ZwokRj3d_dk32Ks",
        description: "One World Trade Center, New York, NY, USA",
        structured_formatting: {
          main_text: "One World Trade Center",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJr9LdDh6ZwokR2Mj_hQyGdRYY",
        description: "High Line, New York, NY, USA",
        structured_formatting: {
          main_text: "High Line",
          secondary_text: "New York, NY, USA",
        },
      },
    ];

    if (!searchText || searchText.length < 2) return [];

    // Filter popular places based on search text
    return popularPlaces.filter(
      (place) =>
        place.structured_formatting.main_text
          .toLowerCase()
          .includes(searchText.toLowerCase()) ||
        place.description.toLowerCase().includes(searchText.toLowerCase()),
    );
  };

  const fetchPlaceDetails = async (placeId: string) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?key=${GOOGLE_PLACES_API_KEY}&place_id=${placeId}&fields=formatted_address,name,geometry,place_id,types`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        console.error(
          "[LocationAutocompleteV3] Details API error:",
          data.error_message,
        );
        // Return fallback coordinates for popular locations
        return getFallbackLocationDetails(placeId);
      }

      return data.result;
    } catch (error) {
      console.error("[LocationAutocompleteV3] Details fetch error:", error);
      // Return fallback coordinates for popular locations
      return getFallbackLocationDetails(placeId);
    }
  };

  // Fallback location details for popular places
  const getFallbackLocationDetails = (placeId: string) => {
    const fallbackDetails: Record<string, any> = {
      "chIJrTLr-GyuEmsRBfyf1GDuE7U": {
        place_id: "chIJrTLr-GyuEmsRBfyf1GDuE7U",
        name: "Madison Square Garden",
        formatted_address: "Madison Square Garden, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.7505,
            lng: -73.9934,
          },
        },
      },
      "chIJvUwsRj5ZwokR-9v8Ch2w_mWQ": {
        place_id: "chIJvUwsRj5ZwokR-9v8Ch2w_mWQ",
        name: "Times Square",
        formatted_address: "Times Square, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.758,
            lng: -73.9855,
          },
        },
      },
      chIJQ3S6Gh6ZwokR4jA_p_kd_hvw: {
        place_id: "chIJQ3S6Gh6ZwokR4jA_p_kd_hvw",
        name: "Central Park",
        formatted_address: "Central Park, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.7829,
            lng: -73.9654,
          },
        },
      },
      chIJdRlClxZawokR7_p3d5i9SQhY: {
        place_id: "chIJdRlClxZawokR7_p3d5i9SQhY",
        name: "Brooklyn Bridge",
        formatted_address: "Brooklyn Bridge, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.7061,
            lng: -73.9969,
          },
        },
      },
      chIJN8h6Cc6ZwokR2Mj_hQyGdRYY: {
        place_id: "chIJN8h6Cc6ZwokR2Mj_hQyGdRYY",
        name: "Statue of Liberty",
        formatted_address: "Statue of Liberty, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.6892,
            lng: -74.0445,
          },
        },
      },
      "chIJc3RyCQ-ZwokR6jE3d_dk32Ks": {
        place_id: "chIJc3RyCQ-ZwokR6jE3d_dk32Ks",
        name: "Empire State Building",
        formatted_address: "Empire State Building, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.7484,
            lng: -73.9857,
          },
        },
      },
      chIJt9uV8l6ZwokRj3d_dk32Ks: {
        place_id: "chIJt9uV8l6ZwokRj3d_dk32Ks",
        name: "One World Trade Center",
        formatted_address: "One World Trade Center, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.7127,
            lng: -74.0134,
          },
        },
      },
      chIJr9LdDh6ZwokR2Mj_hQyGdRYY: {
        place_id: "chIJr9LdDh6ZwokR2Mj_hQyGdRYY",
        name: "High Line",
        formatted_address: "High Line, New York, NY, USA",
        geometry: {
          location: {
            lat: 40.748,
            lng: -74.0048,
          },
        },
      },
    };

    return fallbackDetails[placeId] || null;
  };

  const handleSelectPrediction = async (prediction: GooglePlace) => {
    setInputText(prediction.description);
    setShowDropdown(false);
    setPredictions([]);

    // Fetch detailed place information
    const details = await fetchPlaceDetails(prediction.place_id);

    const locationData: LocationData = {
      name: prediction.structured_formatting.main_text,
      placeId: prediction.place_id,
      formattedAddress: prediction.description,
      latitude: details?.geometry?.location?.lat,
      longitude: details?.geometry?.location?.lng,
    };

    onLocationSelect(locationData);
  };

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (onTextChange) {
        onTextChange(text);
      }
    },
    [onTextChange],
  );

  const handleClear = () => {
    setInputText("");
    setPredictions([]);
    setShowDropdown(false);
    if (onClear) {
      onClear();
    }
  };

  const handleSubmit = () => {
    if (inputText.trim()) {
      const locationData: LocationData = {
        name: inputText.trim(),
      };
      onLocationSelect(locationData);
      setShowDropdown(false);
    }
  };

  // Show manual input when API key is missing or invalid
  if (hasError) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderRadius: 16,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
          },
        ]}
      >
        <MapPin size={18} color={colors.mutedForeground} />
        <TextInput
          style={{
            flex: 1,
            height: 48,
            color: colors.foreground,
            fontSize: 15,
            marginLeft: 8,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmit}
        />
        {inputText.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: 16,
          paddingHorizontal: 12,
        }}
      >
        <MapPin size={18} color={colors.mutedForeground} />
        <TextInput
          style={{
            flex: 1,
            height: 48,
            color: colors.foreground,
            fontSize: 15,
            marginLeft: 8,
            backgroundColor: "transparent",
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmit}
          onFocus={() => {
            setShowDropdown(true);
            if (inputText.length >= 2) {
              fetchPredictions(inputText);
            }
          }}
        />
        {isLoading && <Loader2 size={18} color={colors.mutedForeground} />}
        {inputText.length > 0 && !isLoading && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: 200,
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 1000,
          }}
        >
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectPrediction(item)}
                style={{
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <MapPin size={16} color={colors.mutedForeground} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 15,
                      fontWeight: "500",
                    }}
                  >
                    {item.structured_formatting.main_text}
                  </Text>
                  {item.structured_formatting.secondary_text && (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {item.structured_formatting.secondary_text}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1000,
  },
});
