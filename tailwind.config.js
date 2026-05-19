const { hairlineWidth } = require("nativewind/theme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "*.{js,ts,jsx,tsx,mdx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter-Regular", "system-ui", "sans-serif"],
        "sans-semibold": ["Inter-SemiBold", "system-ui", "sans-serif"],
        "sans-bold": ["Inter-Bold", "system-ui", "sans-serif"],
        display: ["SpaceGrotesk-Regular", "system-ui", "sans-serif"],
        "display-semibold": ["SpaceGrotesk-SemiBold", "system-ui", "sans-serif"],
        "display-bold": ["SpaceGrotesk-Bold", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Semantic type scale — see lib/theme/typography.ts.
        // [size, { lineHeight, letterSpacing, fontWeight }]
        display: ["32px", { lineHeight: "40px", letterSpacing: "-0.5px", fontWeight: "700" }],
        title:   ["22px", { lineHeight: "28px", letterSpacing: "-0.3px", fontWeight: "600" }],
        heading: ["17px", { lineHeight: "22px", letterSpacing: "-0.2px", fontWeight: "600" }],
        body:    ["15px", { lineHeight: "20px", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "16px", fontWeight: "500" }],
        micro:   ["11px", { lineHeight: "14px", letterSpacing: "0.3px", fontWeight: "600" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Tier-accent semantic aliases — see lib/theme/tier-colors.ts
        "accent-cyan": "hsl(var(--accent-cyan))",
        "accent-vip-soft": "hsl(var(--accent-vip-soft))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        purple: "hsl(var(--purple))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require("tailwindcss-animate")],
}
