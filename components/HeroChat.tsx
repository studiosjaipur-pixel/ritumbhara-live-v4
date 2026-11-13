"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { from: "guest" | "ai"; text: string };
const qa = [
  { q: "What time is check-in?", a: "Check-in is from 2 pm. If you arrive earlier, share your time and I will ask the team." },
  { q: "Is there parking?", a: "Yes, one covered spot per unit. Send your arrival time and we will keep it ready." },
  { q: "What is the Wi-Fi password?", a: "It is on the welcome card inside the door. I can also send it here once you check in." },
  { q: "Can we get a late check-out?", a: "I have passed your request to the team. You will get a confirmation here shortly." },
];

export default function HeroChat() {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: "Hi! I am the Ritumbhara AI concierge. Tap a question to see how I reply." }]);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, typing]);

  function ask(i: number) {
    if (typing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMsgs((m) => [...m, { from: "guest", text: qa[i].q }]);
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { from: "ai", text: qa[i].a }]);
    }, reduce ? 0 : 1100);
  }

  return (
    <div className="ai-float bg-ivory rounded-sm shadow-[0_18px_50px_-18px_rgba(38,34,31,0.35)] border border-line overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-burgundy text-ivory">
        <span aria-hidden className="w-2 h-2 rounded-full bg-[#7BD88F]" />
        <span className="text-sm font-semibold">Ritumbhara AI concierge</span>
        <span className="ml-auto text-xs text-ivory/70">Sample replies</span>
      </div>
      <div ref={box} className="h-[280px] overflow-y-auto px-5 py-4 space-y-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={"ai-pop max-w-[85%] rounded-sm px-4 py-3 text-sm leading-relaxed " + (m.from === "ai" ? "bg-sand text-charcoal" : "ml-auto bg-burgundy text-ivory")}>{m.text}</div>
        ))}
        {typing && (
          <div className="bg-sand rounded-sm px-4 py-3 w-16 flex gap-1" aria-label="Typing">
            <span className="ai-dot w-1.5 h-1.5 rounded-full bg-charcoal-muted" />
            <span className="ai-dot w-1.5 h-1.5 rounded-full bg-charcoal-muted" style={{ animationDelay: "0.15s" }} />
            <span className="ai-dot w-1.5 h-1.5 rounded-full bg-charcoal-muted" style={{ animationDelay: "0.3s" }} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-line">
        {qa.map((x, i) => (
          <button key={x.q} type="button" onClick={() => ask(i)} disabled={typing} className="min-h-[40px] px-3 rounded-sm border border-burgundy/40 text-[13px] font-medium text-burgundy hover-fine:bg-burgundy hover-fine:text-ivory active:scale-[0.97] transition-[background-color,color,transform] duration-200 disabled:opacity-50">
            {x.q}
          </button>
        ))}
      </div>
    </div>
  );
}
