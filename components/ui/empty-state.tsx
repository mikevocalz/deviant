import { View, Text } from "react-native";
import { type LucideIcon } from "lucide-react-native";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="w-20 h-20 rounded-full bg-muted/30 items-center justify-center mb-6">
        <Icon size={36} color="#666" strokeWidth={1.5} />
      </View>
      <Text className="text-xl font-semibold text-foreground text-center mb-2">
        {title}
      </Text>
      {description && (
        <Text className="text-muted-foreground text-center text-base leading-6 max-w-[280px]">
          {description}
        </Text>
      )}
      {action && <View className="mt-6">{action}</View>}
    </View>
  );
}
