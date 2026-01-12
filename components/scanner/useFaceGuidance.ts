import { useMemo, useState } from 'react'
import { useFrameProcessor } from 'react-native-vision-camera'
import { runOnJS } from 'react-native-reanimated'
import { useFaceDetector } from 'vision-camera-face-detection'
import { COPY } from './copy'
import { getRandom } from './getRandomCopy'
import { usePreferencesStore, type Locale } from '@/stores/usePreferencesStore'

type Lighting = 'ok' | 'low' | 'high'

type Guidance = {
  hint: string
  lighting: Lighting
  lightingMessage?: string
  hasFace: boolean
}

type Face = {
  yawAngle?: number
  yaw?: number
  brightness?: number
  faceBrightness?: number
}

function estimateLighting(face: any): Lighting {
  const b = face?.brightness ?? face?.faceBrightness ?? null
  if (typeof b === 'number') {
    if (b < 0.35) return 'low'
    if (b > 0.85) return 'high'
  }
  return 'ok'
}

// Serializable face data extracted in worklet
type FaceData = {
  yaw: number
  brightness: number | null
} | null

export function useFaceGuidance() {
  const [guidance, setGuidance] = useState<Guidance>({
    hint: 'Position your face inside the frame',
    lighting: 'ok',
    hasFace: false
  })

  const locale = usePreferencesStore((s) => s.locale)
  const { detectFaces } = useFaceDetector()

  // Process extracted face data on JS thread
  const processFaceData = useMemo(() => (faceData: FaceData) => {
    const currentLocale = locale as Locale

    if (!faceData) {
      setGuidance({
        hint: 'Position your face inside the frame',
        lighting: 'ok',
        lightingMessage: undefined,
        hasFace: false
      })
      return
    }

    const { yaw, brightness } = faceData

    // random playful alignment hint
    const hint: string = getRandom(COPY[currentLocale].faceAlignment)

    // Estimate lighting from brightness
    let lighting: Lighting = 'ok'
    if (typeof brightness === 'number') {
      if (brightness < 0.35) lighting = 'low'
      else if (brightness > 0.85) lighting = 'high'
    }

    let lightingMessage: string = getRandom(COPY[currentLocale].lighting.ok)
    if (lighting === 'low') lightingMessage = getRandom(COPY[currentLocale].lighting.low)
    if (lighting === 'high') lightingMessage = getRandom(COPY[currentLocale].lighting.high)

    // Use yaw to keep guidance actually useful (but still playful)
    let finalHint: string = hint
    if (yaw > 18) finalHint = 'Turn slightly right'
    if (yaw < -18) finalHint = 'Turn slightly left'
    if (Math.abs(yaw) < 4) finalHint = 'Turn your head just a lil bit'

    setGuidance({
      hint: finalHint,
      lighting,
      lightingMessage,
      hasFace: true
    })
  }, [locale])

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    const faces = detectFaces(frame)
    
    // Extract only primitive values inside worklet to avoid serialization issues
    if (!faces || faces.length === 0) {
      runOnJS(processFaceData)(null)
      return
    }

    const face = faces[0] as any
    const faceData: FaceData = {
      yaw: (face?.yawAngle ?? face?.yaw ?? 0) as number,
      brightness: (face?.brightness ?? face?.faceBrightness ?? null) as number | null
    }
    
    runOnJS(processFaceData)(faceData)
  }, [detectFaces, processFaceData])

  return { guidance, frameProcessor }
}
