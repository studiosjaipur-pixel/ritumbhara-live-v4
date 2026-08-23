import type { Config } from "tailwindcss";

const config: Config = {
content: [
"./app/**/*.{ts,tsx}",
"./components/**/*.{ts,tsx}",
],
theme: {
extend: {
colors: {
burgundy: "#97183C",
  gold: "#C8A96A",
  cream: "#F5F1EA",
  },
  transitionTimingFunction: {
    snap: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
},
},
plugins: [],
  };
export default config;
