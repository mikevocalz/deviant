// ============================================================
// useCubeLUT — Loads a .cube file and creates a Skia LUT texture
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { Skia, SkImage, SkRuntimeEffect } from "@shopify/react-native-skia";
import { parseCubeFile, lutToTextureAtlas } from "../utils/cube-parser";
import { LUT_3D_SHADER_SOURCE } from "../utils/lut-shader";
import { CubeLUTFilter, CUBE_LUT_FILTERS } from "../constants";

// ---- Asset requires for every .cube file ----
// Metro needs static require() calls to bundle these.

const CUBE_ASSET_MAP: Record<string, number> = {
  "Film_Look.cube": require("@/assets/luts/Film_Look.cube"),
  "Vintage_Color.cube": require("@/assets/luts/Vintage_Color.cube"),
  "IWLTBAP_K25.cube": require("@/assets/luts/IWLTBAP_K25.cube"),
  "IWLTBAP_K64.cube": require("@/assets/luts/IWLTBAP_K64.cube"),
  "IWLTBAP_K99.cube": require("@/assets/luts/IWLTBAP_K99.cube"),
  "Vivid_LUTs_1.cube": require("@/assets/luts/Vivid_LUTs_1.cube"),
  "Vivid_LUTs_2.cube": require("@/assets/luts/Vivid_LUTs_2.cube"),
  "Vivid_LUTs_3.cube": require("@/assets/luts/Vivid_LUTs_3.cube"),
  "Vivid_LUTs_4.cube": require("@/assets/luts/Vivid_LUTs_4.cube"),
  "Vivid_LUTs_5.cube": require("@/assets/luts/Vivid_LUTs_5.cube"),
  "FLog2C_to_PROVIA_VLog.cube": require("@/assets/luts/FLog2C_to_PROVIA_VLog.cube"),
  "FLog2C_to_Velvia_VLog.cube": require("@/assets/luts/FLog2C_to_Velvia_VLog.cube"),
  "FLog2C_to_ASTIA_VLog.cube": require("@/assets/luts/FLog2C_to_ASTIA_VLog.cube"),
  "FLog2C_to_CLASSIC-CHROME_VLog.cube": require("@/assets/luts/FLog2C_to_CLASSIC-CHROME_VLog.cube"),
  "FLog2C_to_CLASSIC-Neg_VLog.cube": require("@/assets/luts/FLog2C_to_CLASSIC-Neg_VLog.cube"),
  "FLog2C_to_ETERNA_VLog.cube": require("@/assets/luts/FLog2C_to_ETERNA_VLog.cube"),
  "FLog2C_to_ETERNA-BB_VLog.cube": require("@/assets/luts/FLog2C_to_ETERNA-BB_VLog.cube"),
  "FLog2C_to_ACROS_VLog.cube": require("@/assets/luts/FLog2C_to_ACROS_VLog.cube"),
  "FLog2C_to_REALA-ACE_VLog.cube": require("@/assets/luts/FLog2C_to_REALA-ACE_VLog.cube"),
  "FLog2C_to_PRO-Neg_Std_VLog.cube": require("@/assets/luts/FLog2C_to_PRO-Neg_Std_VLog.cube"),
  "ARRI_LogC2Video_Classic709_VLog.cube": require("@/assets/luts/ARRI_LogC2Video_Classic709_VLog.cube"),
  "Cineon_to_Kodak_2383_D65_VLog.cube": require("@/assets/luts/Cineon_to_Kodak_2383_D65_VLog.cube"),
  "Cineon_to_Fuji_3513DI_D65_VLog.cube": require("@/assets/luts/Cineon_to_Fuji_3513DI_D65_VLog.cube"),
  "RED_FilmBias_Rec2020_N-Log_to_Rec709_BT1886_VLog.cube": require("@/assets/luts/RED_FilmBias_Rec2020_N-Log_to_Rec709_BT1886_VLog.cube"),
  "RED_FilmBiasBleachBypass_Rec2020_N-Log_to_Rec709_BT1886_VLog.cube": require("@/assets/luts/RED_FilmBiasBleachBypass_Rec2020_N-Log_to_Rec709_BT1886_VLog.cube"),
  "RED_Achromic_Rec2020_N-Log_to_Rec709_VLog.cube": require("@/assets/luts/RED_Achromic_Rec2020_N-Log_to_Rec709_VLog.cube"),
  "REC709_MEDIUM_CONTRAST_Soft_VLog.cube": require("@/assets/luts/REC709_MEDIUM_CONTRAST_Soft_VLog.cube"),
  "L-Log_to_Classic_VLog.cube": require("@/assets/luts/L-Log_to_Classic_VLog.cube"),
  "L-Log_to_Natural_VLog.cube": require("@/assets/luts/L-Log_to_Natural_VLog.cube"),
  "N-Log_BT2020_to_REC709_BT1886_VLog.cube": require("@/assets/luts/N-Log_BT2020_to_REC709_BT1886_VLog.cube"),
};

// ---- LUT texture cache (keyed by filename) ----

interface CachedLUT {
  image: SkImage;
  size: number;
}

const lutCache = new Map<string, CachedLUT>();

// ---- Compile the shader once ----

let _runtimeEffect: SkRuntimeEffect | null = null;

function getRuntimeEffect(): SkRuntimeEffect | null {
  if (!_runtimeEffect) {
    try {
      const effect = Skia.RuntimeEffect.Make(LUT_3D_SHADER_SOURCE);
      if (!effect) {
        console.error("[useCubeLUT] Skia.RuntimeEffect.Make returned null");
        return null;
      }
      _runtimeEffect = effect;
    } catch (e: any) {
      console.error("[useCubeLUT] Shader compilation error:", e.message);
      return null;
    }
  }
  return _runtimeEffect;
}

// ---- Read asset content (platform-aware) ----

async function readAssetContent(assetModule: number): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Asset download returned no localUri");
  }

  try {
    return await FileSystem.readAsStringAsync(asset.localUri);
  } catch (readErr) {
    // Android bundled assets sometimes can't be read via localUri —
    // try the file:// URI from the asset bundle directly
    if (Platform.OS === "android" && asset.uri) {
      console.warn(
        "[useCubeLUT] localUri read failed, trying asset.uri:",
        asset.uri,
      );
      return await FileSystem.readAsStringAsync(asset.uri);
    }
    throw readErr;
  }
}

// ---- Hook ----

export interface CubeLUTState {
  /** The Skia SkImage atlas texture for the active LUT, or null */
  lutImage: SkImage | null;
  /** The LUT dimension (e.g. 33) */
  lutSize: number;
  /** The compiled SkRuntimeEffect for the LUT shader */
  runtimeEffect: SkRuntimeEffect | null;
  /** Whether a LUT is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Load a specific cube LUT by its CubeLUTFilter definition */
  loadLUT: (filter: CubeLUTFilter) => void;
  /** Clear the active LUT */
  clearLUT: () => void;
  /** The currently selected cube LUT id */
  selectedId: string | null;
}

export function useCubeLUT(): CubeLUTState {
  const [lutImage, setLutImage] = useState<SkImage | null>(null);
  const [lutSize, setLutSize] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runtimeEffect, setRuntimeEffect] = useState<SkRuntimeEffect | null>(
    null,
  );
  const mountedRef = useRef(true);
  // Use refs to avoid stale closures in loadLUT
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const lutImageRef = useRef(lutImage);
  lutImageRef.current = lutImage;

  // Compile shader on mount
  useEffect(() => {
    const effect = getRuntimeEffect();
    if (effect) {
      setRuntimeEffect(effect);
    } else {
      setError("LUT shader unavailable on this device");
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadLUT = useCallback(async (filter: CubeLUTFilter) => {
    // If same LUT is already loaded, toggle it off
    if (selectedIdRef.current === filter.id && lutImageRef.current) {
      setLutImage(null);
      setLutSize(0);
      setSelectedId(null);
      return;
    }

    // Check cache first
    const cached = lutCache.get(filter.filename);
    if (cached) {
      setLutImage(cached.image);
      setLutSize(cached.size);
      setSelectedId(filter.id);
      setError(null);
      return;
    }

    // Load from asset
    const assetModule = CUBE_ASSET_MAP[filter.filename];
    if (!assetModule) {
      setError(`No asset mapping for ${filter.filename}`);
      console.error(`[useCubeLUT] No require() mapping for ${filter.filename}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Read the asset content (platform-aware)
      const content = await readAssetContent(assetModule);

      if (!mountedRef.current) return;

      // Parse the .cube file
      const parsed = parseCubeFile(content);

      // Create the 2D atlas texture
      const atlas = lutToTextureAtlas(parsed);

      // Create Skia SkImage from pixel data
      const data = Skia.Data.fromBytes(atlas.pixels);
      const imageInfo = {
        width: atlas.width,
        height: atlas.height,
        colorType: 4, // RGBA_8888
        alphaType: 1, // Opaque
      };
      const skImage = Skia.Image.MakeImage(imageInfo, data, atlas.width * 4);

      if (!skImage) {
        throw new Error("Skia.Image.MakeImage returned null");
      }

      // Cache it
      lutCache.set(filter.filename, { image: skImage, size: parsed.size });

      if (!mountedRef.current) return;

      setLutImage(skImage);
      setLutSize(parsed.size);
      setSelectedId(filter.id);

      console.log(
        `[useCubeLUT] Loaded "${filter.name}" (${parsed.size}^3, atlas ${atlas.width}x${atlas.height})`,
      );
    } catch (e: any) {
      console.error(`[useCubeLUT] Failed to load ${filter.filename}:`, e);
      if (mountedRef.current) {
        setError(e.message || "Failed to load LUT");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []); // No deps — uses refs for current state

  const clearLUT = useCallback(() => {
    setLutImage(null);
    setLutSize(0);
    setSelectedId(null);
    setError(null);
  }, []);

  return {
    lutImage,
    lutSize,
    runtimeEffect,
    isLoading,
    error,
    loadLUT,
    clearLUT,
    selectedId,
  };
}
