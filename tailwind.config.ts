import type { Config } from "tailwindcss";

const config: Config = {
content: [
"./app/**/*.{ts,tsx}",
"./components/**/*.{ts,tsx}",
],
theme: {
extend: {
colors: {
  // Ritumbhara palette: warm ivory ground, sand surfaces, charcoal text,
  // burgundy as the primary brand accent, muted sage as a restrained secondary accent.
  ivory: "#F8F3EA",
  sand: { DEFAULT: "#EEE4D3", deep: "#E3D5BE" },
  line: "#DDD0BA",
  charcoal: { DEFAULT: "#26221F", soft: "#5B544C", muted: "#6A635B" },
  sage: { DEFAULT: "#5C6952", light: "#A9B59C" },
  burgundy: { DEFAULT: "#97183C", deep: "#7A1231" },
  gold: "#C8A96A",
  cream: "#EEE4D3",
  },
  fontFamily: {
    display: ["var(--font-display)", "Cormorant Garamond", "Georgia", "serif"],
    sans: ["var(--font-sans)", "Manrope", "system-ui", "sans-serif"],
  },
  transitionTimingFunction: {
    snap: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
},
},
plugins: [
  function ({ addVariant }: any) {
    addVariant("hover-fine", "@media (hover: hover) and (pointer: fine) { &:hover }");
    addVariant("group-hover-fine", "@media (hover: hover) and (pointer: fine) { :merge(.group):hover & }");
  },
],
  };
export default config;
