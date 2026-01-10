import { Stack } from "expo-router"

export default function ProtectedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="messages/new" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="profile/[username]" />
      <Stack.Screen name="profile/edit" options={{ presentation: "modal" }} />
      <Stack.Screen name="events/create" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="story/[id]" />
      <Stack.Screen name="story/create" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="comments" />
    </Stack>
  )
}
