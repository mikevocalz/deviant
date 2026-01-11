import * as React from "react"
import {
  Pressable,
  View,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
} from "react-native"
import { Portal } from "@rn-primitives/portal"

interface PopoverContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerLayout: { x: number; y: number; width: number; height: number } | null
  setTriggerLayout: (layout: { x: number; y: number; width: number; height: number } | null) => void
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverContext() {
  const context = React.useContext(PopoverContext)
  if (!context) {
    throw new Error("Popover components must be used within a Popover")
  }
  return context
}

interface PopoverProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function Popover({ children, open: controlledOpen, onOpenChange }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [triggerLayout, setTriggerLayout] = React.useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const open = controlledOpen ?? uncontrolledOpen
  const handleOpenChange = onOpenChange ?? setUncontrolledOpen

  return (
    <PopoverContext.Provider
      value={{ open, onOpenChange: handleOpenChange, triggerLayout, setTriggerLayout }}
    >
      {children}
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const PopoverTrigger = React.forwardRef<View, PopoverTriggerProps>(
  ({ children, asChild }, ref) => {
    const { onOpenChange, setTriggerLayout } = usePopoverContext()
    const triggerRef = React.useRef<View>(null)

    const handlePress = () => {
      triggerRef.current?.measureInWindow((x, y, width, height) => {
        setTriggerLayout({ x, y, width, height })
        onOpenChange(true)
      })
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: triggerRef,
        onPress: handlePress,
      })
    }

    return (
      <Pressable ref={triggerRef} onPress={handlePress}>
        {children}
      </Pressable>
    )
  }
)

PopoverTrigger.displayName = "PopoverTrigger"

type Side = "top" | "bottom" | "left" | "right"
type Align = "start" | "center" | "end"

interface PopoverContentProps {
  children: React.ReactNode
  side?: Side
  align?: Align
  sideOffset?: number
  className?: string
  style?: any
}

function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  className,
  style,
}: PopoverContentProps) {
  const { open, onOpenChange, triggerLayout } = usePopoverContext()
  const fadeAnim = React.useRef(new Animated.Value(0)).current
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current
  const [contentLayout, setContentLayout] = React.useState<{
    width: number
    height: number
  } | null>(null)

  React.useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [open, fadeAnim, scaleAnim])

  const getPosition = React.useCallback(() => {
    if (!triggerLayout || !contentLayout) {
      return { top: 0, left: 0 }
    }

    const { width: screenWidth, height: screenHeight } = Dimensions.get("window")
    let top = 0
    let left = 0

    switch (side) {
      case "bottom":
        top = triggerLayout.y + triggerLayout.height + sideOffset
        break
      case "top":
        top = triggerLayout.y - contentLayout.height - sideOffset
        break
      case "left":
        left = triggerLayout.x - contentLayout.width - sideOffset
        top = triggerLayout.y
        break
      case "right":
        left = triggerLayout.x + triggerLayout.width + sideOffset
        top = triggerLayout.y
        break
    }

    if (side === "bottom" || side === "top") {
      switch (align) {
        case "start":
          left = triggerLayout.x
          break
        case "center":
          left = triggerLayout.x + triggerLayout.width / 2 - contentLayout.width / 2
          break
        case "end":
          left = triggerLayout.x + triggerLayout.width - contentLayout.width
          break
      }
    }

    if (side === "left" || side === "right") {
      switch (align) {
        case "start":
          top = triggerLayout.y
          break
        case "center":
          top = triggerLayout.y + triggerLayout.height / 2 - contentLayout.height / 2
          break
        case "end":
          top = triggerLayout.y + triggerLayout.height - contentLayout.height
          break
      }
    }

    if (left < 8) left = 8
    if (left + contentLayout.width > screenWidth - 8) {
      left = screenWidth - contentLayout.width - 8
    }
    if (top < 8) top = 8
    if (top + contentLayout.height > screenHeight - 8) {
      top = screenHeight - contentLayout.height - 8
    }

    return { top, left }
  }, [triggerLayout, contentLayout, side, align, sideOffset])

  if (!open) return null

  const position = getPosition()

  return (
    <Portal name="popover-portal">
      <Modal transparent visible={open} onRequestClose={() => onOpenChange(false)}>
        <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
                position: "absolute",
                top: position.top,
                left: position.left,
              },
              style,
            ]}
            className={className}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout
              if (!contentLayout || contentLayout.width !== width || contentLayout.height !== height) {
                setContentLayout({ width, height })
              }
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>{children}</Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </Portal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    backgroundColor: "rgb(28, 28, 30)",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
    overflow: "hidden",
  },
})

export { Popover, PopoverTrigger, PopoverContent }
