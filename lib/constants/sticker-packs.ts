/**
 * Sticker packs for the photo editor
 *
 * All stickers are remote URLs loaded by @baronha/react-native-photo-editor.
 * Using Twemoji (Twitter emoji) via jsDelivr CDN — free, high quality, reliable.
 * Using PNG format (72x72) for native photo editor compatibility.
 *
 * DVNT and Ballroom packs use local bundled assets (require()).
 * These are resolved to file URIs at runtime via resolveLocalStickers().
 */

import { Asset } from "expo-asset";

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72";

// ── Local Sticker Packs (bundled assets) ──
export const LOCAL_STICKER_MODULES = {
  dvnt: [
    require("@/assets/images/stickers/dvnt/DVNT-stickers_APP.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_AfterHours.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_CounterCulture.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_DAYPLAY.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_Deviant.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_EnergyCheck.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_FTC.png"),
    require("@/assets/images/stickers/dvnt/DVNT-stickers_OUTSIDE.png"),
    require("@/assets/images/stickers/dvnt/eat-it.png"),
  ],
  ballroom: [
    require("@/assets/images/stickers/ballroom/1-chop.png"),
    require("@/assets/images/stickers/ballroom/ChatGPT Image Feb 12, 2026, 08_28_14 PM.png"),
    require("@/assets/images/stickers/ballroom/ChatGPT Image Feb 12, 2026, 08_30_42 PM.png"),
    require("@/assets/images/stickers/ballroom/ate-that.png"),
    require("@/assets/images/stickers/ballroom/tea.png"),
  ],
} as const;

/**
 * Resolve local asset modules to file:// URIs for the photo editor.
 * Must be called once at runtime (async).
 */
let _resolvedLocalStickers: { dvnt: string[]; ballroom: string[] } | null =
  null;

export async function resolveLocalStickers(): Promise<{
  dvnt: string[];
  ballroom: string[];
}> {
  if (_resolvedLocalStickers) return _resolvedLocalStickers;

  const resolve = async (modules: readonly number[]) => {
    const uris: string[] = [];
    for (const mod of modules) {
      try {
        const asset = Asset.fromModule(mod);
        await asset.downloadAsync();
        if (asset.localUri) uris.push(asset.localUri);
      } catch (e) {
        console.warn("[Stickers] Failed to resolve local asset:", e);
      }
    }
    return uris;
  };

  const [dvnt, ballroom] = await Promise.all([
    resolve(LOCAL_STICKER_MODULES.dvnt),
    resolve(LOCAL_STICKER_MODULES.ballroom),
  ]);

  _resolvedLocalStickers = { dvnt, ballroom };
  return _resolvedLocalStickers;
}

// ── Faces & Expressions ──
const faces = [
  `${TWEMOJI_BASE}/1f602.png`, // 😂
  `${TWEMOJI_BASE}/1f923.png`, // 🤣
  `${TWEMOJI_BASE}/1f60d.png`, // 😍
  `${TWEMOJI_BASE}/1f929.png`, // 🤩
  `${TWEMOJI_BASE}/1f60e.png`, // 😎
  `${TWEMOJI_BASE}/1f973.png`, // 🥳
  `${TWEMOJI_BASE}/1f62d.png`, // 😭
  `${TWEMOJI_BASE}/1f631.png`, // 😱
  `${TWEMOJI_BASE}/1f92f.png`, // 🤯
  `${TWEMOJI_BASE}/1f914.png`, // 🤔
  `${TWEMOJI_BASE}/1f920.png`, // 🤠
  `${TWEMOJI_BASE}/1f47b.png`, // 👻
  `${TWEMOJI_BASE}/1f608.png`, // 😈
  `${TWEMOJI_BASE}/1f975.png`, // 🥵
  `${TWEMOJI_BASE}/1f976.png`, // 🥶
  `${TWEMOJI_BASE}/1f971.png`, // 🥱
  `${TWEMOJI_BASE}/1f913.png`, // 🤓
  `${TWEMOJI_BASE}/1f60b.png`, // 😋
  `${TWEMOJI_BASE}/1f618.png`, // 😘
  `${TWEMOJI_BASE}/1fae3.png`, // 🫣
];

// ── Gestures & People ──
const gestures = [
  `${TWEMOJI_BASE}/1f44d.png`, // 👍
  `${TWEMOJI_BASE}/1f44f.png`, // 👏
  `${TWEMOJI_BASE}/1f64c.png`, // 🙌
  `${TWEMOJI_BASE}/1f4aa.png`, // 💪
  `${TWEMOJI_BASE}/270c.png`, // ✌️
  `${TWEMOJI_BASE}/1f918.png`, // 🤘
  `${TWEMOJI_BASE}/1f919.png`, // 🤙
  `${TWEMOJI_BASE}/1f44c.png`, // 👌
  `${TWEMOJI_BASE}/1f90f.png`, // 🤏
  `${TWEMOJI_BASE}/1f91e.png`, // 🤞
  `${TWEMOJI_BASE}/1f91f.png`, // 🤟
  `${TWEMOJI_BASE}/1f590.png`, // 🖐️
  `${TWEMOJI_BASE}/1f483.png`, // 💃
  `${TWEMOJI_BASE}/1f57a.png`, // 🕺
  `${TWEMOJI_BASE}/1f937.png`, // 🤷
];

// ── Hearts & Love ──
const hearts = [
  `${TWEMOJI_BASE}/2764.png`, // ❤️
  `${TWEMOJI_BASE}/1f9e1.png`, // 🧡
  `${TWEMOJI_BASE}/1f49b.png`, // 💛
  `${TWEMOJI_BASE}/1f49a.png`, // 💚
  `${TWEMOJI_BASE}/1f499.png`, // 💙
  `${TWEMOJI_BASE}/1f49c.png`, // 💜
  `${TWEMOJI_BASE}/1f90d.png`, // 🤍
  `${TWEMOJI_BASE}/1f5a4.png`, // 🖤
  `${TWEMOJI_BASE}/1f90e.png`, // 🤎
  `${TWEMOJI_BASE}/1f498.png`, // 💘
  `${TWEMOJI_BASE}/1f496.png`, // 💖
  `${TWEMOJI_BASE}/1f495.png`, // 💕
  `${TWEMOJI_BASE}/1f48b.png`, // 💋
];

// ── Symbols & Objects ──
const symbols = [
  `${TWEMOJI_BASE}/1f525.png`, // 🔥
  `${TWEMOJI_BASE}/2b50.png`, // ⭐
  `${TWEMOJI_BASE}/1f4af.png`, // 💯
  `${TWEMOJI_BASE}/1f4a5.png`, // 💥
  `${TWEMOJI_BASE}/1f389.png`, // 🎉
  `${TWEMOJI_BASE}/1f38a.png`, // 🎊
  `${TWEMOJI_BASE}/1f680.png`, // 🚀
  `${TWEMOJI_BASE}/26a1.png`, // ⚡
  `${TWEMOJI_BASE}/1f4a3.png`, // 💣
  `${TWEMOJI_BASE}/1f4a8.png`, // 💨
  `${TWEMOJI_BASE}/1f4ab.png`, // 💫
  `${TWEMOJI_BASE}/1f3b6.png`, // 🎶
  `${TWEMOJI_BASE}/1f451.png`, // 👑
  `${TWEMOJI_BASE}/1f48e.png`, // 💎
  `${TWEMOJI_BASE}/1f3af.png`, // 🎯
  `${TWEMOJI_BASE}/1f3c6.png`, // 🏆
  `${TWEMOJI_BASE}/1f514.png`, // 🔔
  `${TWEMOJI_BASE}/1f4f8.png`, // 📸
  `${TWEMOJI_BASE}/1f3a4.png`, // 🎤
  `${TWEMOJI_BASE}/1f3b5.png`, // 🎵
];

// ── Food & Drink ──
const food = [
  `${TWEMOJI_BASE}/1f355.png`, // 🍕
  `${TWEMOJI_BASE}/1f354.png`, // 🍔
  `${TWEMOJI_BASE}/1f37f.png`, // 🍿
  `${TWEMOJI_BASE}/1f370.png`, // 🍰
  `${TWEMOJI_BASE}/1f377.png`, // 🍷
  `${TWEMOJI_BASE}/1f37e.png`, // 🍾
  `${TWEMOJI_BASE}/2615.png`, // ☕
  `${TWEMOJI_BASE}/1f9cb.png`, // 🧋
  `${TWEMOJI_BASE}/1f36d.png`, // 🍭
  `${TWEMOJI_BASE}/1f352.png`, // 🍒
];

// ── Animals ──
const animals = [
  `${TWEMOJI_BASE}/1f436.png`, // 🐶
  `${TWEMOJI_BASE}/1f431.png`, // 🐱
  `${TWEMOJI_BASE}/1f98b.png`, // 🦋
  `${TWEMOJI_BASE}/1f984.png`, // 🦄
  `${TWEMOJI_BASE}/1f43b.png`, // 🐻
  `${TWEMOJI_BASE}/1f981.png`, // 🦁
  `${TWEMOJI_BASE}/1f40d.png`, // 🐍
  `${TWEMOJI_BASE}/1f985.png`, // 🦅
  `${TWEMOJI_BASE}/1f419.png`, // 🐙
  `${TWEMOJI_BASE}/1f988.png`, // 🦈
];

// ── Weather & Nature ──
const nature = [
  `${TWEMOJI_BASE}/2600.png`, // ☀️
  `${TWEMOJI_BASE}/1f319.png`, // 🌙
  `${TWEMOJI_BASE}/1f308.png`, // 🌈
  `${TWEMOJI_BASE}/1f4a7.png`, // 💧
  `${TWEMOJI_BASE}/2744.png`, // ❄️
  `${TWEMOJI_BASE}/1f30a.png`, // 🌊
  `${TWEMOJI_BASE}/1f339.png`, // 🌹
  `${TWEMOJI_BASE}/1f33b.png`, // 🌻
  `${TWEMOJI_BASE}/1f335.png`, // 🌵
  `${TWEMOJI_BASE}/1f340.png`, // 🍀
];

// ── Flags & Signs ──
const flags = [
  `${TWEMOJI_BASE}/1f6a9.png`, // 🚩
  `${TWEMOJI_BASE}/1f3f3.png`, // 🏳️
  `${TWEMOJI_BASE}/1f3f4.png`, // 🏴
  `${TWEMOJI_BASE}/2757.png`, // ❗
  `${TWEMOJI_BASE}/2753.png`, // ❓
  `${TWEMOJI_BASE}/1f198.png`, // 🆘
  `${TWEMOJI_BASE}/1f4a4.png`, // 💤
  `${TWEMOJI_BASE}/1f6ab.png`, // 🚫
  `${TWEMOJI_BASE}/2705.png`, // ✅
  `${TWEMOJI_BASE}/274c.png`, // ❌
];

/**
 * All stickers combined — passed to PhotoEditor.open({ stickers })
 */
export const ALL_STICKERS: string[] = [
  ...faces,
  ...gestures,
  ...hearts,
  ...symbols,
  ...food,
  ...animals,
  ...nature,
  ...flags,
];

export const stickerPacks = {
  faces,
  gestures,
  hearts,
  symbols,
  food,
  animals,
  nature,
  flags,
};

// Type for all pack keys including local packs
export type StickerPackKey = keyof typeof stickerPacks | "dvnt" | "ballroom";
