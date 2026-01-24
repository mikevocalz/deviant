import { useRef, useEffect, useState } from "react"
import { View, StyleSheet, Text } from "react-native"
import { GooglePlacesAutocomplete, GooglePlaceData, GooglePlaceDetail } from "react-native-google-places-autocomplete"
import { MapPin, AlertCircle } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

interface LocationData {
  name: string
  latitude?: number
  longitude?: number
  placeId?: string
}

interface LocationAutocompleteProps {
  value?: string
  placeholder?: string
  onLocationSelect: (location: LocationData) => void
  onClear?: () => void
  onTextChange?: (text: string) => void
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ""

export function LocationAutocomplete({
  value,
  placeholder = "Search location...",
  onLocationSelect,
  onClear,
  onTextChange,
}: LocationAutocompleteProps) {
  const { colors } = useColorScheme()
  const ref = useRef<any>(null)
  const [inputText, setInputText] = useState(value || "")
  const [hasError, setHasError] = useState(false)
  
  // Check if API key is configured
  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.warn("[LocationAutocomplete] Google Places API key not configured. Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env file.")
      setHasError(true)
    }
  }, [])
  
  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== inputText) {
      setInputText(value)
      // Update the GooglePlacesAutocomplete internal value
      if (ref.current) {
        ref.current.setAddressText(value)
      }
    }
  }, [value])

  const handlePress = (data: GooglePlaceData, details: GooglePlaceDetail | null) => {
    const locationName = data.description || details?.formatted_address || details?.name || inputText
    const locationData: LocationData = {
      name: locationName,
      placeId: data.place_id,
      latitude: details?.geometry?.location?.lat,
      longitude: details?.geometry?.location?.lng,
    }
    setInputText(locationName)
    onLocationSelect(locationData)
  }
  
  const handleTextChange = (text: string) => {
    setInputText(text)
    
    if (!text) {
      if (onClear) onClear()
    } else {
      // Allow manual text entry - update parent with the typed text
      // This enables the form to be valid even without selecting from dropdown
      if (onTextChange) {
        onTextChange(text)
      } else {
        // Fallback: Update location with just the name (no coordinates)
        onLocationSelect({ name: text })
      }
    }
  }

  // Show error state if API key is missing
  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <AlertCircle size={18} color={colors.destructive} />
        <Text style={{ color: colors.mutedForeground, fontSize: 14, flex: 1 }}>
          Location search unavailable. Enter address manually.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder}
        fetchDetails={true}
        onPress={handlePress}
        textInputProps={{
          placeholderTextColor: colors.mutedForeground,
          onChangeText: handleTextChange,
        }}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          language: "en",
          types: "establishment|geocode",
        }}
        styles={{
          container: {
            flex: 0,
          },
          textInputContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 16,
            paddingHorizontal: 12,
          },
          textInput: {
            flex: 1,
            height: 48,
            color: colors.foreground,
            fontSize: 15,
            backgroundColor: "transparent",
            marginLeft: 8,
          },
          listView: {
            backgroundColor: colors.card,
            borderRadius: 12,
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
          },
          row: {
            backgroundColor: colors.card,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
          },
          separator: {
            height: 1,
            backgroundColor: colors.border,
          },
          description: {
            color: colors.foreground,
            fontSize: 14,
          },
          poweredContainer: {
            display: "none",
          },
        }}
        renderLeftButton={() => (
          <MapPin size={18} color={colors.mutedForeground} />
        )}
        enablePoweredByContainer={false}
        debounce={300}
        minLength={2}
        nearbyPlacesAPI="GooglePlacesSearch"
        GooglePlacesDetailsQuery={{
          fields: "geometry,formatted_address,name",
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
})

export type { LocationData }
