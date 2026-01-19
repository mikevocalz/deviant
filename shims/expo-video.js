// Server-side stub for expo-video
const { View } = require("react-native");

const VideoView = View;

const useVideoPlayer = () => ({
  play: () => {},
  pause: () => {},
  seekBy: () => {},
  replay: () => {},
  currentTime: 0,
  duration: 0,
  playing: false,
  muted: false,
  loop: false,
  volume: 1,
});

module.exports = { VideoView, useVideoPlayer };
