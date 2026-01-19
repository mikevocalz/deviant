// Server-side stub for expo-image-picker
const noopAsync = async () => ({ canceled: true, assets: [] });

module.exports = {
  launchImageLibraryAsync: noopAsync,
  launchCameraAsync: noopAsync,
  requestMediaLibraryPermissionsAsync: async () => ({
    status: "undetermined",
    granted: false,
  }),
  requestCameraPermissionsAsync: async () => ({
    status: "undetermined",
    granted: false,
  }),
  getMediaLibraryPermissionsAsync: async () => ({
    status: "undetermined",
    granted: false,
  }),
  getCameraPermissionsAsync: async () => ({
    status: "undetermined",
    granted: false,
  }),
  MediaTypeOptions: {
    All: "All",
    Videos: "Videos",
    Images: "Images",
  },
  UIImagePickerControllerQualityType: {},
  UIImagePickerPresentationStyle: {},
};
