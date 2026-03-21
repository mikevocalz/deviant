/**
 * Location Discovery Screen
 * Shows posts at a specific location (Instagram-style location page)
 * Route: /(protected)/location/[placeId]
 */

import {
  View,
  Text,
  Pressable,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Grid3X3,
  Bookmark,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useColorScheme } from '@/lib/hooks';
import { DvntMap } from '@/src/components/map';
import { LegendList } from '@/components/list';
import { ErrorBoundary } from '@/components/error-boundary';
import type { NormalizedLocation } from '@/lib/types/location';
import type { Post } from '@/lib/types';
import {
  openDirections,
  openMapView,
  hasValidCoordinates,
  getStaticMapUrl,
} from '@/lib/utils/location';
import { postsApi } from '@/lib/api/posts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 2;
const GRID_CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// Location header with map preview
function LocationHeader({
  location,
  postCount,
}: {
  location: NormalizedLocation | null;
  postCount: number;
}) {
  const { colors } = useColorScheme();
  const router = useRouter();

  if (!location) return null;

  const hasCoords = hasValidCoordinates(location);

  return (
    <View className="relative">
      {/* Map Preview or Static Map Image */}
      {hasCoords ? (
        <View className="h-48 w-full">
          <DvntMap
            center={[location.longitude, location.latitude]}
            zoom={15}
            markers={[
              {
                id: 'location',
                coordinate: [location.longitude, location.latitude],
                title: location.name,
              },
            ]}
            showControls={false}
          />
        </View>
      ) : (
        <View
          className="h-32 w-full items-center justify-center"
          style={{ backgroundColor: colors.muted + '30' }}
        >
          <MapPin size={40} color={colors.mutedForeground} />
        </View>
      )}

      {/* Location Info Overlay */}
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8"
        style={{
          backgroundImage: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        }}
      >
        <Text className="text-2xl font-bold text-white" numberOfLines={1}>
          {location.name}
        </Text>
        {location.city && (
          <Text className="text-sm text-white/80" numberOfLines={1}>
            {location.city}
            {location.country ? `, ${location.country}` : ''}
          </Text>
        )}
        <Text className="text-xs text-white/60 mt-1">
          {postCount} {postCount === 1 ? 'post' : 'posts'}
        </Text>
      </View>
    </View>
  );
}

// Post grid item
function PostGridItem({
  post,
  onPress,
}: {
  post: Post;
  onPress: () => void;
}) {
  const imageUri = post.thumbnail || post.media?.[0]?.url;
  const isVideo = post.type === 'video';

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: GRID_CELL_SIZE,
          height: GRID_CELL_SIZE,
          marginRight: GRID_GAP,
          marginBottom: GRID_GAP,
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            className="w-full h-full items-center justify-center"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <MapPin size={24} color="#666" />
          </View>
        )}
        {isVideo && (
          <View className="absolute top-2 right-2">
            <View className="w-4 h-4 bg-black/60 rounded items-center justify-center">
              <View className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
            </View>
          </View>
        )}
        {post.hasMultipleImages && (
          <View className="absolute top-2 right-2 bg-black/50 rounded px-1 py-0.5">
            <Text className="text-[10px] text-white font-bold">+</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function LocationScreenContent() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState<NormalizedLocation | null>(null);

  // Fetch posts at this location
  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['posts', 'by-location', placeId],
    queryFn: async () => {
      // TODO: Replace with actual API call once backend supports placeId search
      // For now, fetch all posts and filter client-side
      const allPosts = await postsApi.getExplorePosts(100);
      return allPosts.filter(
        (p) => p.location && p.location.toLowerCase().includes(placeId.toLowerCase())
      );
    },
    enabled: !!placeId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Try to reconstruct location from posts
  useEffect(() => {
    if (posts.length > 0 && posts[0].location) {
      // Create a mock location from the first post
      setLocation({
        placeId: placeId,
        provider: 'google',
        name: posts[0].location.split(',')[0] || posts[0].location,
        formattedAddress: posts[0].location,
        latitude: 0,
        longitude: 0,
      });
    }
  }, [posts, placeId]);

  const handlePostPress = useCallback(
    (postId: string) => {
      router.push(`/(protected)/post/${postId}`);
    },
    [router]
  );

  const handleGetDirections = useCallback(() => {
    if (location && hasValidCoordinates(location)) {
      openDirections(location, { label: location.name });
    }
  }, [location]);

  const renderGridItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostGridItem post={item} onPress={() => handlePostPress(item.id)} />
    ),
    [handlePostPress]
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-foreground" numberOfLines={1}>
          Location
        </Text>
        {location && hasValidCoordinates(location) && (
          <Pressable onPress={handleGetDirections} hitSlop={12}>
            <Navigation size={22} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Location Header with Map */}
      <LocationHeader location={location} postCount={posts.length} />

      {/* Posts Grid */}
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <View
              className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent"
              style={{ transform: [{ rotate: '0deg' }] }}
            />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-muted-foreground text-center">
              Failed to load posts. Pull to refresh.
            </Text>
          </View>
        ) : posts.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <MapPin size={48} color={colors.mutedForeground} />
            <Text className="text-muted-foreground text-center mt-4">
              No posts at this location yet
            </Text>
            <Text className="text-sm text-muted-foreground/60 text-center mt-2">
              Be the first to post here!
            </Text>
          </View>
        ) : (
          <LegendList
            data={posts}
            numColumns={GRID_COLS}
            renderItem={renderGridItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              padding: GRID_GAP,
              paddingBottom: insets.bottom + 20,
            }}
            estimatedItemSize={GRID_CELL_SIZE}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={refetch} />
            }
          />
        )}
      </View>
    </View>
  );
}

export default function LocationScreen() {
  return (
    <ErrorBoundary screenName="Location">
      <LocationScreenContent />
    </ErrorBoundary>
  );
}
