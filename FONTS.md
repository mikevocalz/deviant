# Custom Fonts

This project uses two custom font families:

## Font Families

### Inter (Sans Serif)
- **Inter-Regular** - Use with `font-sans` or `className="font-sans"`
- **Inter-SemiBold** - Use with `font-sans-semibold`
- **Inter-Bold** - Use with `font-sans-bold`

### Space Grotesk (Display)
- **SpaceGrotesk-Regular** - Use with `font-display`
- **SpaceGrotesk-SemiBold** - Use with `font-display-semibold`
- **SpaceGrotesk-Bold** - Use with `font-display-bold`

## Usage Examples

```tsx
// Body text with Inter
<Text className="font-sans text-base">Regular body text</Text>
<Text className="font-sans-semibold text-base">Semi-bold text</Text>
<Text className="font-sans-bold text-lg">Bold heading</Text>

// Display text with Space Grotesk
<Text className="font-display text-4xl">Display heading</Text>
<Text className="font-display-semibold text-3xl">Semi-bold display</Text>
<Text className="font-display-bold text-2xl">Bold display</Text>
```

## Font Loading

Fonts are loaded in `app/_layout.tsx` using `expo-font` and are available throughout the app once the splash screen completes.
