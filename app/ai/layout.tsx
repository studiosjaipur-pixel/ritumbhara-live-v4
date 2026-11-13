import localFont from "next/font/local";

// Montserrat for the Ritumbhara AI page only. Self-hosted like the site's other fonts (latin subset, SIL OFL).
const montserrat = localFont({
  src: [
    { path: "../fonts/montserrat-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/montserrat-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/montserrat-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/montserrat-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-montserrat",
  display: "swap",
  adjustFontFallback: "Arial",
});

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <div className={montserrat.variable + " ai-scope"}>{children}</div>;
}
