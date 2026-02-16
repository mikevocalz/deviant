import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { EditorScreen } from "@/src/stories-editor";
import { useEditorStore } from "@/src/stories-editor/stores/editor-store";
import type { EditorMode } from "@/src/stories-editor";
import { Debouncer } from "@tanstack/react-pacer";

export default function StoryEditorRoute() {
  const { uri, type, initialMode } = useLocalSearchParams<{
    uri: string;
    type: string;
    initialMode?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  // Deferred reset so user doesn't see blank editor during transition
  const deferredReset = useRef(
    new Debouncer(() => useEditorStore.getState().resetEditor(), { wait: 200 }),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleClose = () => {
    router.navigate("/(protected)/story/create");
    deferredReset.current.maybeExecute();
  };

  const handleSave = (editedUri: string) => {
    // Navigate first, THEN reset — so create screen can consume editedUri
    // before editor state is cleared
    router.navigate({
      pathname: "/(protected)/story/create",
      params: { editedUri, editedIndex: "0" },
    });
    deferredReset.current.maybeExecute();
  };

  return (
    <EditorScreen
      mediaUri={uri ? decodeURIComponent(uri) : ""}
      mediaType={(type as "image" | "video") || "image"}
      onClose={handleClose}
      onSave={handleSave}
      initialMode={initialMode as EditorMode | undefined}
    />
  );
}
