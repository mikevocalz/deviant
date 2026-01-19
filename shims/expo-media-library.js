// Server-side stub for expo-media-library
const noopAsync = async () => null;

module.exports = {
  getPermissionsAsync: async () => ({ status: "undetermined", granted: false }),
  requestPermissionsAsync: async () => ({
    status: "undetermined",
    granted: false,
  }),
  getAssetsAsync: async () => ({
    assets: [],
    endCursor: "",
    hasNextPage: false,
    totalCount: 0,
  }),
  getAlbumsAsync: async () => [],
  createAssetAsync: noopAsync,
  createAlbumAsync: noopAsync,
  deleteAssetsAsync: noopAsync,
  MediaType: {
    audio: "audio",
    photo: "photo",
    video: "video",
    unknown: "unknown",
  },
  SortBy: {
    default: "default",
    mediaType: "mediaType",
    width: "width",
    height: "height",
    creationTime: "creationTime",
    modificationTime: "modificationTime",
    duration: "duration",
  },
};
