/**
 * Centralized Permission Orchestration System
 *
 * Features:
 * - Flow-based permission requests
 * - Contextual rationale UI
 * - Platform-specific handling
 * - Graceful fallbacks
 * - Permission state caching
 */

import { Platform, Alert, Linking } from "react-native";
import React from "react";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as Camera from "expo-camera";
import * as AV from "expo-av";
import { useUIStore } from "@/lib/stores/ui-store";

export enum PermissionType {
  CAMERA = "camera",
  MICROPHONE = "microphone",
  PHOTO_LIBRARY = "photoLibrary",
  LOCATION_WHEN_IN_USE = "locationWhenInUse",
  LOCATION_ALWAYS = "locationAlways",
  NOTIFICATIONS = "notifications",
  MEDIA_LIBRARY = "mediaLibrary",
  READ_EXTERNAL_STORAGE = "readExternalStorage",
  WRITE_EXTERNAL_STORAGE = "writeExternalStorage",
  RECORD_AUDIO = "recordAudio",
}

export enum PermissionFlows {
  POST_CREATION = [
    PermissionType.CAMERA,
    PermissionType.PHOTO_LIBRARY,
    PermissionType.LOCATION_WHEN_IN_USE,
  ],
  EVENT_CREATION = [
    PermissionType.CAMERA,
    PermissionType.PHOTO_LIBRARY,
    PermissionType.LOCATION_WHEN_IN_USE,
  ],
  STORY_CREATION = [
    PermissionType.CAMERA,
    PermissionType.MICROPHONE,
    PermissionType.PHOTO_LIBRARY,
  ],
  LIVE_CALL = [PermissionType.MICROPHONE, PermissionType.CAMERA],
  LOCATION_SEARCH = [PermissionType.LOCATION_WHEN_IN_USE],
  MEDIA_UPLOAD = [PermissionType.PHOTO_LIBRARY, PermissionType.MEDIA_LIBRARY],
}

export interface PermissionRationale {
  title: string;
  message: string;
  ctaText: string;
  skipText?: string;
}

export interface PermissionFlowConfig {
  flow: PermissionFlows;
  rationale?: Partial<Record<PermissionType, PermissionRationale>>;
  required?: PermissionType[];
  optional?: PermissionType[];
  onSuccess?: () => void;
  onFailure?: (denied: PermissionType[]) => void;
  onPartial?: (granted: PermissionType[], denied: PermissionType[]) => void;
}

export interface PermissionState {
  granted: PermissionType[];
  denied: PermissionType[];
  blocked: PermissionType[];
  unavailable: PermissionType[];
}

class PermissionOrchestrator {
  private cache = new Map<PermissionType, PermissionStatus>();
  private listeners = new Set<(state: PermissionState) => void>();

  /**
   * Check current permission status
   */
  async checkPermission(permission: PermissionType): Promise<PermissionStatus> {
    // Check cache first
    if (this.cache.has(permission)) {
      return this.cache.get(permission)!;
    }

    try {
      const result = await getPermissionsAsync(permission);
      this.cache.set(permission, result.status);
      return result.status;
    } catch (error) {
      console.warn(`[Permissions] Failed to check ${permission}:`, error);
      return PermissionStatus.UNDETERMINED;
    }
  }

  /**
   * Check multiple permissions
   */
  async checkPermissions(
    permissions: PermissionType[],
  ): Promise<Record<PermissionType, PermissionStatus>> {
    const results: Record<PermissionType, PermissionStatus> = {} as any;

    await Promise.all(
      permissions.map(async (permission) => {
        results[permission] = await this.checkPermission(permission);
      }),
    );

    return results;
  }

  /**
   * Get current permission state
   */
  async getPermissionState(): Promise<PermissionState> {
    const allPermissions = Object.values(PermissionType);
    const statuses = await this.checkPermissions(allPermissions);

    const state: PermissionState = {
      granted: [],
      denied: [],
      blocked: [],
      unavailable: [],
    };

    for (const [permission, status] of Object.entries(statuses) as [
      PermissionType,
      PermissionStatus,
    ][]) {
      switch (status) {
        case PermissionStatus.GRANTED:
          state.granted.push(permission);
          break;
        case PermissionStatus.DENIED:
          state.denied.push(permission);
          break;
        case PermissionStatus.BLOCKED:
          state.blocked.push(permission);
          break;
        case PermissionStatus.UNAVAILABLE:
          state.unavailable.push(permission);
          break;
      }
    }

    return state;
  }

  /**
   * Show rationale dialog for permission
   */
  private async showRationale(
    permission: PermissionType,
    rationale: PermissionRationale,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        rationale.title,
        rationale.message,
        [
          {
            text: rationale.skipText || "Not Now",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: rationale.ctaText,
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true },
      );
    });
  }

  /**
   * Request a single permission
   */
  async requestPermission(
    permission: PermissionType,
    rationale?: PermissionRationale,
  ): Promise<PermissionStatus> {
    // Check current status first
    const currentStatus = await this.checkPermission(permission);

    // Already granted
    if (currentStatus === PermissionStatus.GRANTED) {
      return currentStatus;
    }

    // Show rationale if provided
    if (rationale && currentStatus === PermissionStatus.DENIED) {
      const shouldProceed = await this.showRationale(permission, rationale);
      if (!shouldProceed) {
        return currentStatus;
      }
    }

    try {
      const result = await requestPermissionsAsync(permission);
      this.cache.set(permission, result.status);
      return result.status;
    } catch (error) {
      console.warn(`[Permissions] Failed to request ${permission}:`, error);
      return PermissionStatus.UNDETERMINED;
    }
  }

  /**
   * Request multiple permissions in a flow
   */
  async requestFlow(config: PermissionFlowConfig): Promise<PermissionState> {
    const { flow, rationale, required = [], optional = [] } = config;
    const permissions = [...required, ...optional];

    let granted: PermissionType[] = [];
    let denied: PermissionType[] = [];
    let blocked: PermissionType[] = [];
    let unavailable: PermissionType[] = [];

    // Check current state first
    const currentState = await this.getPermissionState();
    const alreadyGranted = currentState.granted;
    const toRequest = permissions.filter((p) => !alreadyGranted.includes(p));

    // Request each permission
    for (const permission of toRequest) {
      const status = await this.requestPermission(
        permission,
        rationale?.[permission],
      );

      switch (status) {
        case PermissionStatus.GRANTED:
          granted.push(permission);
          break;
        case PermissionStatus.DENIED:
          denied.push(permission);
          break;
        case PermissionStatus.BLOCKED:
          blocked.push(permission);
          break;
        case PermissionStatus.UNAVAILABLE:
          unavailable.push(permission);
          break;
      }
    }

    // Combine with already granted
    granted = [
      ...granted,
      ...alreadyGranted.filter((p) => permissions.includes(p)),
    ];

    const finalState: PermissionState = {
      granted,
      denied,
      blocked,
      unavailable,
    };

    // Check if required permissions are satisfied
    const requiredDenied = required.filter((p) => !granted.includes(p));
    const hasAllRequired = requiredDenied.length === 0;

    // Trigger callbacks
    if (hasAllRequired && config.onSuccess) {
      config.onSuccess();
    } else if (!hasAllRequired && config.onFailure) {
      config.onFailure(requiredDenied);
    } else if (config.onPartial) {
      config.onPartial(granted, denied);
    }

    // Update listeners
    this.notifyListeners(finalState);

    return finalState;
  }

  /**
   * Open app settings for blocked permissions
   */
  async openSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn("[Permissions] Failed to open settings:", error);
    }
  }

  /**
   * Subscribe to permission state changes
   */
  subscribe(listener: (state: PermissionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(state: PermissionState): void {
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get default rationales for common flows
   */
  static getDefaultRationale(permission: PermissionType): PermissionRationale {
    switch (permission) {
      case PermissionType.CAMERA:
        return {
          title: "Camera Access",
          message:
            "DVNT needs access to your camera to take photos and videos for posts and stories.",
          ctaText: "Allow Camera",
          skipText: "Maybe Later",
        };

      case PermissionType.MICROPHONE:
        return {
          title: "Microphone Access",
          message:
            "DVNT needs access to your microphone to record videos with audio and make calls.",
          ctaText: "Allow Microphone",
          skipText: "Maybe Later",
        };

      case PermissionType.PHOTO_LIBRARY:
        return {
          title: "Photo Library Access",
          message:
            "DVNT needs access to your photo library to select photos and videos for your posts.",
          ctaText: "Allow Photos",
          skipText: "Maybe Later",
        };

      case PermissionType.LOCATION_WHEN_IN_USE:
        return {
          title: "Location Access",
          message:
            "DVNT needs location access to show nearby events and venues, and to add locations to your posts.",
          ctaText: "Allow Location",
          skipText: "Maybe Later",
        };

      case PermissionType.NOTIFICATIONS:
        return {
          title: "Push Notifications",
          message:
            "Enable notifications to stay updated with messages, event reminders, and activity on your posts.",
          ctaText: "Enable Notifications",
          skipText: "Skip",
        };

      default:
        return {
          title: "Permission Required",
          message: "This permission is needed for full app functionality.",
          ctaText: "Allow",
          skipText: "Skip",
        };
    }
  }
}

// Singleton instance
export const permissionOrchestrator = new PermissionOrchestrator();

// Convenience hooks
export function usePermissions() {
  const [state, setState] = React.useState<PermissionState>({
    granted: [],
    denied: [],
    blocked: [],
    unavailable: [],
  });

  React.useEffect(() => {
    const unsubscribe = permissionOrchestrator.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    state,
    checkPermission: permissionOrchestrator.checkPermission.bind(
      permissionOrchestrator,
    ),
    requestPermission: permissionOrchestrator.requestPermission.bind(
      permissionOrchestrator,
    ),
    requestFlow: permissionOrchestrator.requestFlow.bind(
      permissionOrchestrator,
    ),
    openSettings: permissionOrchestrator.openSettings.bind(
      permissionOrchestrator,
    ),
  };
}

export function usePermissionFlow(
  flow: PermissionFlows,
  config?: Partial<PermissionFlowConfig>,
) {
  const { requestFlow, state } = usePermissions();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const execute = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestFlow({
        flow,
        rationale: Object.fromEntries(
          Object.values(flow).map((permission) => [
            permission,
            PermissionOrchestrator.getDefaultRationale(permission),
          ]),
        ),
        ...config,
      });

      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Permission request failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [flow, config, requestFlow]);

  return {
    execute,
    isLoading,
    error,
    state,
  };
}
