# DVNT - Social Media App

A React Native social media app built with Expo, featuring stories, feed, messaging, and more.

## Prerequisites

### Java Development Kit (JDK 17)

**Important:** This project requires **JDK 17** for Android builds. Using a newer version (like JDK 21+) will cause build failures with the error:

```
Unsupported class file major version 69
```

#### Install JDK 17 (macOS)

Using Homebrew:

```bash
brew install --cask zulu@17
```

Or download directly from [Azul Zulu](https://www.azul.com/downloads/?version=java-17-lts&package=jdk).

#### Set JAVA_HOME

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
```

Then reload:

```bash
source ~/.zshrc
```

#### Verify Installation

```bash
java -version
# Should show: openjdk version "17.x.x"
```

## Installation

```bash
# Install dependencies
pnpm install

# Generate native projects (if needed)
npx expo prebuild
```

## Running the App

### Development Server

```bash
pnpm start
```

### Android

```bash
# If JAVA_HOME is set correctly:
npx expo run:android

# Or explicitly set JAVA_HOME:
JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home npx expo run:android
```

### iOS

```bash
npx expo run:ios
```

### Web

```bash
pnpm web
```

## Project Structure

```
app/
├── (auth)/           # Authentication screens (login, signup, onboarding)
├── (protected)/      # Protected screens requiring auth
│   ├── (tabs)/       # Main tab navigation (feed, explore, create, activity, profile)
│   ├── chat/         # Chat screens with sheet navigator
│   ├── comments/     # Comments with nested replies
│   ├── post/         # Post detail screens
│   ├── story/        # Story viewer
│   ├── messages.tsx  # Messages list
│   └── search.tsx    # Search screen
├── _layout.tsx       # Root layout with auth guards
└── settings.tsx      # Settings screen

components/
├── feed/             # Feed components (FeedPost, Feed)
├── stories/          # Stories bar component
└── ui/               # Reusable UI components

lib/
├── data.ts           # Mock data for posts, stories, etc.
├── storage.ts        # MMKV storage adapter for Zustand
├── stores/           # Zustand state stores
└── hooks/            # Custom React hooks
```

## Tech Stack

- **Framework:** React Native with Expo SDK 54
- **Navigation:** Expo Router v6
- **Styling:** NativeWind (TailwindCSS)
- **State Management:** Zustand with MMKV persistence
- **UI Components:** Custom components with Lucide icons
- **Video:** expo-video
- **Images:** expo-image
- **Bottom Sheets:** @lodev09/react-native-true-sheet

## Troubleshooting

### Build Fails with "Unsupported class file major version"

You're using the wrong Java version. Make sure JDK 17 is installed and `JAVA_HOME` is set correctly.

### Metro Bundler Port Already in Use

Kill existing processes:

```bash
lsof -ti:8081 | xargs kill -9
```

### Native Module Not Found

Rebuild the native app:

```bash
npx expo run:android
# or
npx expo run:ios
```

## License

Private
