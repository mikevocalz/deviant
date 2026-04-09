import { shouldHydrateFeedTextSlides } from "../lib/feed/text-hydration";

describe("Feed text post hydration gate", () => {
  test("does not re-fetch a single-slide text post that is already complete", () => {
    expect(
      shouldHydrateFeedTextSlides({
        isTextPost: true,
        id: "post-1",
        textSlideCount: 1,
        initialTextSlidesLength: 1,
        caption: "One complete slide",
      }),
    ).toBe(false);
  });

  test("re-fetches when the known slide count is greater than the hydrated slides", () => {
    expect(
      shouldHydrateFeedTextSlides({
        isTextPost: true,
        id: "post-2",
        textSlideCount: 3,
        initialTextSlidesLength: 1,
        caption: "Slide one",
      }),
    ).toBe(true);
  });

  test("re-fetches legacy text posts that only have caption content and no slides", () => {
    expect(
      shouldHydrateFeedTextSlides({
        isTextPost: true,
        id: "post-3",
        initialTextSlidesLength: 0,
        caption: "Legacy caption fallback",
      }),
    ).toBe(true);
  });

  test("never hydrates non-text posts", () => {
    expect(
      shouldHydrateFeedTextSlides({
        isTextPost: false,
        id: "post-4",
        textSlideCount: 2,
        initialTextSlidesLength: 0,
        caption: "ignored",
      }),
    ).toBe(false);
  });
});
