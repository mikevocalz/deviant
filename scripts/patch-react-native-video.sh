#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCH_FILE="$SCRIPT_DIR/patches/react-native-video-7.0.0-beta.8.patch"
TARGET_DIR="$REPO_ROOT/node_modules/react-native-video"
TYPE_FILE="$TARGET_DIR/lib/typescript/commonjs/src/core/types/VideoInformation.d.ts"
ONLOAD_FILE="$TARGET_DIR/nitrogen/generated/android/ReactNativeVideoOnLoad.cpp"
IOS_ASSET_INFO_FILE="$TARGET_DIR/ios/core/Extensions/AVURLAsset+getAssetInformation.swift"

if [ ! -d "$TARGET_DIR" ]; then
  echo "[patch-react-native-video] WARNING: $TARGET_DIR not found, skipping"
  exit 0
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "[patch-react-native-video] WARNING: $PATCH_FILE not found, skipping"
  exit 0
fi

needs_nitro_patch=false
needs_ios_patch=false

if ! grep -q "duration: UInt64;" "$TYPE_FILE" 2>/dev/null || ! grep -q "registerAllNatives" "$ONLOAD_FILE" 2>/dev/null; then
  needs_nitro_patch=true
fi

if [ -f "$IOS_ASSET_INFO_FILE" ] && ! grep -q "let resolvedDuration: UInt64" "$IOS_ASSET_INFO_FILE" 2>/dev/null; then
  needs_ios_patch=true
fi

if [ "$needs_nitro_patch" = false ] && [ "$needs_ios_patch" = false ]; then
  echo "[patch-react-native-video] Already patched, skipping"
  exit 0
fi

if [ "$needs_nitro_patch" = true ]; then
  if ! (cd "$TARGET_DIR" && patch -p1 --dry-run --forward < "$PATCH_FILE" >/dev/null); then
    echo "[patch-react-native-video] ERROR: patch does not apply cleanly to $TARGET_DIR" >&2
    exit 1
  fi

  (cd "$TARGET_DIR" && patch -p1 --forward < "$PATCH_FILE" >/dev/null)
  echo "[patch-react-native-video] Patched react-native-video Nitro bindings"
fi

if [ "$needs_ios_patch" = true ]; then
  python3 - "$IOS_ASSET_INFO_FILE" <<'PYEOF'
import sys
from pathlib import Path

path = Path(sys.argv[1])
content = path.read_text()

old = """import AVFoundation

extension AVURLAsset {
  func getAssetInformation() async throws -> VideoInformation {
    // Initialize with default values
    var videoInformation = VideoInformation(
      bitrate: Double.nan,
      width: Double.nan,
      height: Double.nan,
      duration: -1,
      fileSize: -1,
      isHDR: false,
      isLive: false,
      orientation: .unknown
    )

    videoInformation.fileSize = try await VideoFileHelper.getFileSize(for: url)

    // Check if asset is live stream
    if duration.flags.contains(.indefinite) {
      videoInformation.duration = -1
      videoInformation.isLive = true
    } else {
      videoInformation.duration = Int64(CMTimeGetSeconds(duration))
      videoInformation.isLive = false
    }

    if let videoTrack = tracks(withMediaType: .video).first {
      let size = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
      videoInformation.width = size.width
      videoInformation.height = size.height

      videoInformation.bitrate = Double(videoTrack.estimatedDataRate)

      videoInformation.orientation = videoTrack.orientation

      if #available(iOS 14.0, tvOS 14.0, visionOS 1.0, *) {
        videoInformation.isHDR = videoTrack.hasMediaCharacteristic(.containsHDRVideo)
      }
    } else if url.pathExtension == "m3u8" {
      // For HLS streams, we cannot get video track information directly
      // So we download manifest and try to extract video information from it

      let manifestContent = try await HLSManifestParser.downloadManifest(from: url)
      let manifestInfo = try HLSManifestParser.parseM3U8Manifest(manifestContent)

      if let videoStream = manifestInfo.streams.first {
        videoInformation.width = Double(videoStream.width ?? Int(Double.nan))
        videoInformation.height = Double(videoStream.height ?? Int(Double.nan))
        videoInformation.bitrate = Double(videoStream.bandwidth ?? Int(Double.nan))
      }

      if videoInformation.width > 0 && videoInformation.height > 0 {
        if videoInformation.width == videoInformation.height {
          videoInformation.orientation = .square
        } else if videoInformation.width > videoInformation.height {
          videoInformation.orientation = .landscapeRight
        } else if videoInformation.width < videoInformation.height {
          videoInformation.orientation = .portrait
        } else {
          videoInformation.orientation = .unknown
        }
      }
    }

    return videoInformation
  }
}
"""

new = """import AVFoundation

extension AVURLAsset {
  func getAssetInformation() async throws -> VideoInformation {
    let fileSize = try await VideoFileHelper.getFileSize(for: url)
    let resolvedFileSize = UInt64(max(Int64(0), fileSize))

    let isLive = duration.flags.contains(.indefinite)
    let resolvedDuration: UInt64
    if isLive {
      resolvedDuration = 0
    } else {
      let seconds = CMTimeGetSeconds(duration)
      resolvedDuration = seconds.isFinite && seconds >= 0 ? UInt64(seconds.rounded(.towardZero)) : 0
    }

    var bitrate = Double.nan
    var width = Double.nan
    var height = Double.nan
    var isHDR = false
    var orientation: VideoOrientation = .unknown

    if let videoTrack = tracks(withMediaType: .video).first {
      let size = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
      width = size.width
      height = size.height
      bitrate = Double(videoTrack.estimatedDataRate)
      orientation = videoTrack.orientation

      if #available(iOS 14.0, tvOS 14.0, visionOS 1.0, *) {
        isHDR = videoTrack.hasMediaCharacteristic(.containsHDRVideo)
      }
    } else if url.pathExtension == "m3u8" {
      // For HLS streams, we cannot get video track information directly
      // So we download manifest and try to extract video information from it

      let manifestContent = try await HLSManifestParser.downloadManifest(from: url)
      let manifestInfo = try HLSManifestParser.parseM3U8Manifest(manifestContent)

      if let videoStream = manifestInfo.streams.first {
        width = Double(videoStream.width ?? Int(Double.nan))
        height = Double(videoStream.height ?? Int(Double.nan))
        bitrate = Double(videoStream.bandwidth ?? Int(Double.nan))
      }

      if width > 0 && height > 0 {
        if width == height {
          orientation = .square
        } else if width > height {
          orientation = .landscapeRight
        } else if width < height {
          orientation = .portrait
        } else {
          orientation = .unknown
        }
      }
    }

    return VideoInformation(
      bitrate: bitrate,
      width: width,
      height: height,
      duration: resolvedDuration,
      fileSize: resolvedFileSize,
      isHDR: isHDR,
      isLive: isLive,
      orientation: orientation
    )
  }
}
"""

if "let resolvedDuration: UInt64" in content:
    print("[patch-react-native-video] iOS asset information helper already patched")
    sys.exit(0)

if old not in content:
    print(f"[patch-react-native-video] ERROR: unexpected contents in {path}", file=sys.stderr)
    sys.exit(1)

path.write_text(content.replace(old, new))
print("[patch-react-native-video] Patched iOS asset information helper")
PYEOF
fi
