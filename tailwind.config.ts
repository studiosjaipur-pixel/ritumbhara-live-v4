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
},
},
plugins: [],
  };
export default config;
