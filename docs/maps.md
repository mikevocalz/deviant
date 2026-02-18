# Maps — MapLibre + MapTiler

Production-ready map implementation using **MapLibre GL Native** (via `@maplibre/maplibre-react-native`) with **MapTiler** as the tile/style provider.

## Architecture

```
src/components/map/
├── DvntMap.tsx       # Native component (iOS/Android) — MapLibre GL
├── DvntMap.web.tsx   # Web fallback — placeholder card
├── maptiler.ts       # Style URL builder + runtime key validation
└── index.ts          # Barrel exports
```

- **Native (iOS/Android):** Full MapLibre GL map with vector tiles, markers via `ShapeSource` + `CircleLayer`, overlay controls (zoom, recenter) using lucide icons.
- **Web:** Graceful placeholder with "Open in Google Maps" CTA. No crash.

## Setup

### 1. Get a MapTiler API Key

1. Sign up at [cloud.maptiler.com](https://cloud.maptiler.com)
2. Create a new key (free tier: 100k tiles/month)
3. Add it to your `.env`:

```env
EXPO_PUBLIC_MAPTILER_KEY=your_key_here
# Optional: override the default dark style
# EXPO_PUBLIC_MAPTILER_STYLE_URL=https://api.maptiler.com/maps/streets-v2-dark/style.json
```

### 2. Enable the Feature Flag

Maps are gated behind a feature flag. In dev, maps auto-enable if the key is present. For production, explicitly enable:

```env
EXPO_PUBLIC_FF_MAPS_ENABLED=true
```

### 3. EAS Secrets

Add `MAPTILER_KEY` to your EAS secrets:

```bash
eas secret:create --name MAPTILER_KEY --value your_key_here --scope project
```

The key is referenced in `eas.json` as `${MAPTILER_KEY}` across all build profiles.

### 4. Dev Client Required

MapLibre is a native module — it does **not** work in Expo Go. You need a development build:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

## Usage

### Basic Map

```tsx
import { DvntMap } from "@/src/components/map";

<DvntMap
  center={[-73.9857, 40.7484]}
  zoom={14}
  showUserLocation
/>
```

### With Markers

```tsx
<DvntMap
  center={[-73.9857, 40.7484]}
  zoom={12}
  markers={[
    {
      id: "event-1",
      coordinate: [-73.9857, 40.7484],
      title: "DVNT Launch Party",
      subtitle: "Tonight at 9pm",
      icon: "event",
    },
  ]}
  onMarkerPress={(id) => router.push(`/events/${id}`)}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `center` | `[lng, lat]` | NYC | Map center coordinate |
| `zoom` | `number` | `12` | Zoom level |
| `markers` | `DvntMapMarker[]` | `[]` | Markers to display |
| `onMarkerPress` | `(id: string) => void` | — | Marker tap callback |
| `showUserLocation` | `boolean` | `false` | Show blue dot |
| `pitch` | `number` | `0` | Camera tilt |
| `bearing` | `number` | `0` | Camera rotation |
| `showControls` | `boolean` | `true` | Show zoom/recenter overlays |
| `className` | `string` | — | NativeWind classes |
| `onMapReady` | `() => void` | — | Fires when map tiles load |

## Integration Points

### Events Map View

`components/events/events-map-view.tsx` — renders all events with coordinates on a DvntMap. Toggled via the map/list button in the events tab header. State managed by `events-screen-store.ts` (`showMapView` / `toggleMapView`).

### Create Event Location Preview

`app/(protected)/events/create.tsx` — shows a small DvntMap preview when the user selects a location via autocomplete. Uses `showControls={false}` for a clean inline preview.

## Performance Notes

- **No useState** — all map-related UI state lives in Zustand stores
- **Memoized GeoJSON** — markers converted to GeoJSON via `useMemo` to prevent re-renders
- **React.memo** — `DvntMap` is wrapped in `React.memo`
- **Stable callbacks** — `onMarkerPress` wrapped in `useCallback`
- **Lazy loading** — MapLibre native module is loaded via `try/catch require()` to prevent crashes in Expo Go

## Troubleshooting

### Map shows "Map Unavailable"

- **Missing key:** Check `EXPO_PUBLIC_MAPTILER_KEY` is set in `.env`
- **Expo Go:** MapLibre requires a dev build. Run `npx expo run:ios`
- **Feature flag off:** Set `EXPO_PUBLIC_FF_MAPS_ENABLED=true`

### Map loads but tiles are blank

- Verify your MapTiler key is valid at [cloud.maptiler.com](https://cloud.maptiler.com)
- Check the style URL is accessible: open `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=YOUR_KEY` in a browser

### EAS build fails

- Ensure `MAPTILER_KEY` is added as an EAS secret
- Run `eas secret:list` to verify
- The config plugin `@maplibre/maplibre-react-native` is registered in `app.config.js`

### Android: GLSurfaceView crash

- MapLibre uses `TextureView` by default on newer versions. If you see GL crashes, check the device GPU compatibility.

### Web: Map doesn't render

- Expected behavior. Web uses a placeholder fallback. Native MapLibre doesn't support web.
