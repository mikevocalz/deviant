import { View, Text, Image, TouchableOpacity, Dimensions, ScrollView } from 'react-native'
import { useRef, useState, useEffect } from 'react'
import { Camera, useCameraDevice } from 'react-native-vision-camera'
import { useUIStore } from '@/lib/stores/ui-store'
import { Camera as CameraIcon, X } from 'lucide-react-native'
import { Button } from '@/components/ui'
import { persistVerificationPhoto } from '@/lib/media'
import { useVerificationStore } from '@/lib/stores/useVerificationStore'
import { Canvas, Path, Line, Shadow } from '@shopify/react-native-skia'
import { COPY } from '@/components/scanner/copy'
import { getRandom } from '@/components/scanner/getRandomCopy'

const PURPLE = '#8A40CF'
const WHITE = '#FFFFFF'

// Skia-based face frame with scanning animation
function FaceFrameOverlay({ isScanning, scanProgress, containerWidth, containerHeight }: { 
  isScanning: boolean
  scanProgress: number
  containerWidth: number
  containerHeight: number 
}) {
  const frameWidth = 200
  const frameHeight = 280
  const cornerLength = 40
  const strokeWidth = 4
  const borderRadius = 12

  // Center the frame within the container
  const offsetX = (containerWidth - frameWidth) / 2
  const offsetY = (containerHeight - frameHeight) / 2

  const color = isScanning ? PURPLE : WHITE

  // Corner paths with rounded corners using quadratic bezier curves
  // Top-left: vertical line down, curve, horizontal line right
  const topLeftPath = `M ${offsetX},${offsetY + cornerLength} L ${offsetX},${offsetY + borderRadius} Q ${offsetX},${offsetY} ${offsetX + borderRadius},${offsetY} L ${offsetX + cornerLength},${offsetY}`
  // Top-right: horizontal line left, curve, vertical line down
  const topRightPath = `M ${offsetX + frameWidth - cornerLength},${offsetY} L ${offsetX + frameWidth - borderRadius},${offsetY} Q ${offsetX + frameWidth},${offsetY} ${offsetX + frameWidth},${offsetY + borderRadius} L ${offsetX + frameWidth},${offsetY + cornerLength}`
  // Bottom-left: vertical line up, curve, horizontal line right
  const bottomLeftPath = `M ${offsetX},${offsetY + frameHeight - cornerLength} L ${offsetX},${offsetY + frameHeight - borderRadius} Q ${offsetX},${offsetY + frameHeight} ${offsetX + borderRadius},${offsetY + frameHeight} L ${offsetX + cornerLength},${offsetY + frameHeight}`
  // Bottom-right: horizontal line left, curve, vertical line up
  const bottomRightPath = `M ${offsetX + frameWidth - cornerLength},${offsetY + frameHeight} L ${offsetX + frameWidth - borderRadius},${offsetY + frameHeight} Q ${offsetX + frameWidth},${offsetY + frameHeight} ${offsetX + frameWidth},${offsetY + frameHeight - borderRadius} L ${offsetX + frameWidth},${offsetY + frameHeight - cornerLength}`

  // Scan line Y position
  const scanLineY = offsetY + (scanProgress / 100) * frameHeight

  if (containerWidth === 0 || containerHeight === 0) return null

  return (
    <Canvas style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {/* Top-left corner */}
      <Path path={topLeftPath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round">
        {isScanning && <Shadow dx={0} dy={0} blur={10} color={PURPLE} />}
      </Path>
      
      {/* Top-right corner */}
      <Path path={topRightPath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round">
        {isScanning && <Shadow dx={0} dy={0} blur={10} color={PURPLE} />}
      </Path>
      
      {/* Bottom-left corner */}
      <Path path={bottomLeftPath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round">
        {isScanning && <Shadow dx={0} dy={0} blur={10} color={PURPLE} />}
      </Path>
      
      {/* Bottom-right corner */}
      <Path path={bottomRightPath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round">
        {isScanning && <Shadow dx={0} dy={0} blur={10} color={PURPLE} />}
      </Path>

      {/* Animated scan line */}
      {isScanning && (
        <Line
          p1={{ x: offsetX + 5, y: scanLineY }}
          p2={{ x: offsetX + frameWidth - 5, y: scanLineY }}
          color={PURPLE}
          strokeWidth={2}
        >
          <Shadow dx={0} dy={0} blur={10} color={PURPLE} />
        </Line>
      )}
    </Canvas>
  )
}

export default function FaceScanTab() {
  const device = useCameraDevice('front')
  const camRef = useRef<Camera>(null)

  const [capturedUri, setCapturedUri] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 })

  const faceComplete = useVerificationStore((s) => s.faceComplete)
  const storedFaceUri = useVerificationStore((s) => s.faceImageUri)
  const setFaceImageUri = useVerificationStore((s) => s.setFaceImageUri)
  const setFaceComplete = useVerificationStore((s) => s.setFaceComplete)

  const [currentPhrase, setCurrentPhrase] = useState(() => getRandom(COPY.en.okLight))
  const showToast = useUIStore((s) => s.showToast)

  // Rotate phrase every 4 seconds (cycles through okLight phrases by default)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase(getRandom(COPY.en.okLight))
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // If already completed, show the stored image
  if (faceComplete && storedFaceUri) {
    return (
      <View className="flex-1 bg-background rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
        <Image source={{ uri: storedFaceUri }} className="flex-1" resizeMode="cover" />
        <View className="absolute top-3 right-3">
          <TouchableOpacity 
            onPress={() => {
              setFaceComplete(false)
              setFaceImageUri('')
              setCapturedUri(null)
            }}
            className="bg-black/50 rounded-full p-2"
          >
            <X size={20} color="white" />
          </TouchableOpacity>
        </View>
        <View className="absolute bottom-4 left-0 right-0 items-center">
          <View className="bg-primary/90 px-4 py-2 rounded-full">
            <Text className="text-primary-foreground font-medium">Face Captured ✓</Text>
          </View>
        </View>
      </View>
    )
  }

  if (!device) {
    return (
      <View className="flex-1 bg-card rounded-2xl items-center justify-center" style={{ minHeight: 300 }}>
        <Text className="text-muted">Camera not available</Text>
      </View>
    )
  }

  async function capture() {
    try {
      setBusy(true)
      setIsScanning(true)
      setScanProgress(0)

      // Animate scan progress over 2 seconds
      const duration = 2000
      const startTime = Date.now()
      
      await new Promise<void>((resolve) => {
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min((elapsed / duration) * 100, 100)
          setScanProgress(progress)
          
          if (progress < 100) {
            requestAnimationFrame(animate)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(animate)
      })

      // Take photo after scan completes
      const photo = await camRef.current?.takePhoto({ flash: 'off' })
      if (!photo?.path) throw new Error('Unable to capture')
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`
      setCapturedUri(uri)
    } catch (e: any) {
      showToast('error', 'Capture failed', e?.message)
    } finally {
      setBusy(false)
      setIsScanning(false)
      setScanProgress(0)
    }
  }

  async function confirm() {
    if (!capturedUri) return
    try {
      setBusy(true)
      const saved = await persistVerificationPhoto(capturedUri, `face-${Date.now()}.jpg`)
      setFaceImageUri(saved)
      setFaceComplete(true)
      showToast('success', 'Face scan complete')
    } catch (e: any) {
      showToast('error', 'Face verification failed', e?.message)
    } finally {
      setBusy(false)
    }
  }

  // Preview captured image
  if (capturedUri) {
    return (
      <ScrollView className="flex-1 bg-background rounded-2xl overflow-hidden" contentContainerStyle={{ flexGrow: 1, minHeight: 300 }}>
        <Image source={{ uri: capturedUri }} className="flex-1" resizeMode="cover" style={{ minHeight: 250 }} />

        <View className="absolute bottom-6 left-0 right-0 px-6 gap-3">
          <Text className="text-center text-white text-sm mb-2">
            Make sure your face is clear and well lit
          </Text>
          <View className="flex-row gap-3">
            <Button variant="outline" onPress={() => setCapturedUri(null)} className="flex-1 bg-black/30">
              <Text className="text-white">Retake</Text>
            </Button>
            <Button onPress={confirm} disabled={busy} className="flex-1">
              <Text className="text-primary-foreground">{busy ? 'Saving...' : 'Use This Photo'}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    )
  }

  // Camera view
  return (
    <View className="flex-1 rounded-2xl overflow-hidden" style={{ minHeight: 380 }}>
      {/* Header */}
      <View className="justify-center flex-row items-center px-4 py-3 bg-card">
        <Text className="text-foreground text-center font-semibold">Face Verification</Text>
        <View />
      </View>

      {/* Camera */}
      <View 
        className="flex-1 bg-background flex-col"
        onLayout={(e) => setCameraLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        <Camera
          ref={camRef}
          style={{ flex: 1, aspectRatio: 16/9 }}
          device={device}
          isActive
          photo
        />

        {/* Status badge */}
        <View className="absolute my-2 left-3">
          <View className="bg-black/60 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">
              {isScanning ? `Scanning ${Math.round(scanProgress)}%` : 'Ready'}
            </Text>
          </View>
        </View>

        {/* Skia face frame overlay with scanning animation */}
        <FaceFrameOverlay 
          isScanning={isScanning} 
          scanProgress={scanProgress} 
          containerWidth={cameraLayout.width}
          containerHeight={cameraLayout.height}
        />

        {/* Face guidance banner with rotating phrases */}
        {!isScanning && (
          <View className="absolute left-0 right-0 bottom-3 px-6 items-center">
            <View className="rounded-xl px-4 py-3 bg-black/40">
              <Text className="text-white text-base text-center">{currentPhrase}</Text>
            </View>
          </View>
        )}

        {/* Bottom instruction */}
        <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent mb-2">
          <Text className="text-center text-white text-sm font-medium">
            {isScanning ? 'Hold still, scanning face...' : ''}
          </Text>
        </View>
      </View>

      {/* Take Selfie button */}
      <View className="p-2  bg-card ">
        <Button onPress={capture} disabled={busy || isScanning} className="flex-row  items-center justify-center">
          <View className="flex-row  mr-4 items-center"><CameraIcon size={20} color="white" style={{ marginRight: 2 }}/></View>
          <Text className=" text-primary-foreground text-center tracking-wider font-extrabold">
            {isScanning ? 'Scanning...' : busy ? 'Capturing...' : 'Take Selfie'}
          </Text>
        </Button>
      </View>
    </View>
  )
}
