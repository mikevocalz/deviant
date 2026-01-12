import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera'
import { runOnJS } from 'react-native-reanimated'
import { StyleSheet } from 'react-native'
import { useTextRecognition } from 'react-native-vision-camera-text-recognition'

type Block = { text: string; boundingBox?: { x: number; y: number; width: number; height: number } }

export function OCRScanner({
  onResult,
  cameraRef,
  isActive
}: {
  onResult: (blocks: Block[]) => void
  cameraRef: React.RefObject<Camera | null>
  isActive: boolean
}) {
  const device = useCameraDevice('back')
  const { scanText } = useTextRecognition({ language: 'latin' })

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    const results = scanText(frame)
    if (results?.length) {
      const blocks: Block[] = []
      for (const result of results) {
        if (result.blocks) {
          const [blockFrame, , , , blockText] = result.blocks
          blocks.push({
            text: blockText,
            boundingBox: blockFrame ? {
              x: blockFrame.x,
              y: blockFrame.y,
              width: blockFrame.width,
              height: blockFrame.height
            } : undefined
          })
        }
      }
      if (blocks.length) {
        runOnJS(onResult)(blocks)
      }
    }
  }, [scanText])

  if (!device) return null

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      frameProcessor={frameProcessor}
      photo
    />
  )
}
