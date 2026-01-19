// Server-side stub for react-native-vision-camera
const Camera = ({ children }) => children;
const useCameraDevice = () => null;
const useCameraDevices = () => ({ back: null, front: null });
const useCameraFormat = () => null;
const useFrameProcessor = () => {};
const useCodeScanner = () => ({});
const useCameraPermission = () => ({
  hasPermission: false,
  requestPermission: async () => false,
});
const useMicrophonePermission = () => ({
  hasPermission: false,
  requestPermission: async () => false,
});

Camera.getCameraPermissionStatus = async () => "denied";
Camera.requestCameraPermission = async () => "denied";
Camera.getMicrophonePermissionStatus = async () => "denied";
Camera.requestMicrophonePermission = async () => "denied";
Camera.getAvailableCameraDevices = async () => [];

module.exports = {
  default: Camera,
  Camera,
  useCameraDevice,
  useCameraDevices,
  useCameraFormat,
  useFrameProcessor,
  useCodeScanner,
  useCameraPermission,
  useMicrophonePermission,
};
