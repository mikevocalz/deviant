import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { EditorScreen } from "@/src/stories-editor";
import { useEditorStore } from "@/src/stories-editor/stores/editor-store";
import type { EditorMode } from "@/src/stories-editor";

export default function StoryEditorRoute() {
  const { uri, type, initialMode } = useLocalSearchParams<{
    uri: string;
    type: string;
    initialMode?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const resetEditor = useEditorStore((s) => s.resetEditor);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleClose = () => {
    resetEditor();
    router.back();
  };

  const handleSave = (editedUri: string) => {
    // Pass edited URI back via params — story/create picks it up via useFocusEffect
    resetEditor();
    router.navigate({
      pathname: "/(protected)/story/create",
      params: { editedUri, editedIndex: "0" },
    });
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
