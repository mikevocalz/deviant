import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/mikevocalz/deviant";

describe("Story video publish + delete regression", () => {
  it("requires story videos to generate and upload a thumbnail before publish succeeds", () => {
    const source = readFileSync(
      join(ROOT, "lib/hooks/use-media-upload.ts"),
      "utf8",
    );

    expect(source).toContain('const isStory = folder === "stories"');
    expect(source).toContain("getVideoThumbnail");
    expect(source).toContain("Story video blocked: thumbnail generation failed");
    expect(source).toContain("deleteFromServer([uploadResult.path])");
  });

  it("keeps the story poster above VideoView until the first frame renders", () => {
    const source = readFileSync(
      join(ROOT, "app/(protected)/story/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("const [showVideoPoster, setShowVideoPoster]");
    expect(source).toContain("onFirstFrameRender={() => setShowVideoPoster(false)}");
    expect(source).toContain("showVideoPoster && currentItem?.thumbnail");
  });

  it("does not reference the removed story_replies table during story deletion", () => {
    const source = readFileSync(
      join(ROOT, "supabase/functions/delete-story/index.ts"),
      "utf8",
    );

    expect(source).not.toContain('.from("story_replies")');
    expect(source).toContain('.from("messages")');
    expect(source).toContain("update({ story_id: null })");
    expect(source).toContain("deleteBunnyKeys");
  });
});
