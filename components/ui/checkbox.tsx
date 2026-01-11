import * as React from 'react'
import { Pressable, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { cn } from '@/lib/utils/cn'

export function Checkbox({
  checked,
  onCheckedChange
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <Pressable onPress={() => onCheckedChange(!checked)} className="p-1">
      <View className={cn('h-5 w-5 rounded border items-center justify-center', checked ? 'bg-primary border-primary' : 'border-border bg-card')}>
        {checked ? <Check size={14} color="white" /> : null}
      </View>
    </Pressable>
  )
}
