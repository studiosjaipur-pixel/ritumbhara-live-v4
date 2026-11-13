"use client";
import Link from "next/link";

const OS_LOGIN = "https://ritumbhara-hospitality-os-q6er.vercel.app";
const links = [
  { href: "#features", label: "Features" },
  { href: "#agents", label: "AI agents" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

// Slim glass bar under the site header: section links on the left, log in + CTA on the right.
// `logo` (optional) renders in the top-right corner.
export default function AiStickyBar({ logo }: { logo?: React.ReactNode }) {
  return (
    <div className="ai-glass sticky top-20 z-40 border-b border-line/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
        <nav aria-label="On this page" className="hidden md:flex items-center gap-6 text-[13px] font-semibold text-charcoal">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover-fine:text-burgundy transition-colors">{l.label}</a>
          ))}
        </nav>
        <span className="md:hidden text-[13px] font-semibold text-charcoal">Ritumbhara AI</span>
        <div className="flex items-center gap-3 sm:gap-4">
          <a href={OS_LOGIN} target="_blank" rel="noopener noreferrer nofollow" className="text-[13px] font-semibold text-charcoal hover-fine:text-burgundy transition-colors">Log in</a>
          <Link href="#early-access" className="inline-flex items-center min-h-[36px] px-4 rounded-full bg-burgundy text-ivory text-[13px] font-semibold hover-fine:bg-burgundy-deep active:scale-[0.97] transition-[background-color,transform] duration-200">Get early access</Link>
          {logo}
        </div>
      </div>
    </div>
  );
}
